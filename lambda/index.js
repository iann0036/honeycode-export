const winston = require('winston');
const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const uuid = require('uuid');
const fastcsv = require('fast-csv');

const s3 = new AWS.S3();
const LOG = winston.createLogger({
    level: "debug",
    transports: [
        new winston.transports.Console()
    ]
});

exports.handler = async (event, context) => {
    const loginReq = await fetch("https://bhauthngateway.us-east-1.honeycode.aws/v2/login", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            "origin": "https://builder.honeycode.aws"
        },
        "body": JSON.stringify({
            "emailAddress": process.env.EMAIL_ADDRESS,
            "password": process.env.PASSWORD
        }),
        "method": "POST",
        "mode": "cors"
    });
    
    let apitoken = '';
    for (let cookie of loginReq.headers.raw()['set-cookie']) {
        if (cookie.startsWith("bluesky-api-token=")) {
            apitoken = cookie.split("=")[1].split(";")[0];
        }
    }

    const templateReq = await fetch("https://control.us-west-2.honeycode.aws/templatelist-prod.txt", {
        "headers": {
            "accept": "*/*",
            "cookie": "bluesky-api-token=" + apitoken,
            "origin": "https://builder.honeycode.aws"
        },
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    });
    const templateData = await templateReq.json();
    const sheetsRegion = templateData['templates'][0]['arn'].split(":")[3];
    const sheetsAccount = templateData['templates'][0]['arn'].split(":")[4];

    const workbookReq = await fetch("https://control.us-west-2.honeycode.aws/", {
        "headers": {
            "accept": "*/*",
            "content-encoding": "amz-1.0",
            "content-type": "application/json",
            "x-amz-target": "com.amazon.sheets.control.api.SheetsControlServiceAPI_20170701.DescribeWorkbook",
            "x-client-id": "clientRegion|BeehiveSDSJSUtils||||",
            "cookie": "bluesky-api-token=" + apitoken,
            "origin": "https://builder.honeycode.aws"
        },
        "body": JSON.stringify({
            "workbook": "arn:aws:sheets:" + sheetsRegion + ":" + sheetsAccount + ":workbook:" + process.env.WORKBOOK
        }),
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });
    const workbookData = await workbookReq.json();

    LOG.info("Downloading data from arn:aws:sheets:" + sheetsRegion + ":" + sheetsAccount + ":sheet:" + process.env.WORKBOOK + "/" + process.env.SHEET);

    let csv = [];
    let nextrow = 0;
    let lastcount = 1000;

    while (lastcount == 1000) {
        const celldataReq = await fetch("https://" + workbookData['workbook']['endpoint'] + "/external/", {
            "headers": {
                "accept": "application/json, text/javascript, */*",
                "content-encoding": "amz-1.0, amz-1.0",
                "content-type": "application/json",
                "x-amz-target": "com.amazon.sheets.data.external.SheetsDataService.GetCellRange",
                "x-client-id": "prod|Sheets||||",
                "cookie": "bluesky-api-token=" + apitoken,
                "origin": "https://builder.honeycode.aws"
            },
            "body": JSON.stringify({
                "eventType": "GetCellRange",
                "sheetArn": "arn:aws:sheets:" + sheetsRegion + ":" + sheetsAccount + ":sheet:" + process.env.WORKBOOK + "/" + process.env.SHEET,
                "clientToken": uuid.v4(),
                "ranges": [{
                    "start": {
                        "row": nextrow,
                        "column": 0
                    },
                    "end": {
                        "row": nextrow + 1000,
                        "column": 99
                    }
                }],
                "maxResults": 1000
            }),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
        const celldataData = await celldataReq.json();

        lastcount = celldataData['cells'].length;

        for (let cell of celldataData['cells']) {
            if (cell['address']['row'] == 0 && csv.length > 100) { // dont duplicate header row
                continue;
            }

            if (!csv[cell['address']['row']]) {
                csv[cell['address']['row']] = [];
            }
            csv[cell['address']['row']][cell['address']['column']] = cell['value'];
        }

        if (lastcount == 1000) {
            nextrow = csv.length - 1;
            delete csv[nextrow];
        }
    }

    const putbody = await fastcsv.writeToBuffer(csv, {headers: true});

    await s3.putObject({
        Body: putbody,
        ContentType: 'text/csv',
        Bucket: process.env.BUCKET,
        Key: process.env.WORKBOOK + "/" + process.env.SHEET + ".csv"
    }).promise();
};
