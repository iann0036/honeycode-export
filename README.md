# Honeycode Export

> Looking to import data into Honeycode? Check out [honeycode-appflow-integration](https://github.com/iann0036/honeycode-appflow-integration).

Periodically export Honeycode table data into S3.

## Installation

> Currently, the only possible region is `us-west-2`.

First, create your Honeycode account and create an ADMIN user and record credentials (email address / password).

[![Launch Stack](https://cdn.rawgit.com/buildkite/cloudformation-launch-stack-button-svg/master/launch-stack.svg)](https://us-west-2.console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/quickcreate?templateUrl=https%3A%2F%2Fs3.amazonaws.com%2Fianmckay-us-west-2%2Fhoneycode-export%2Ftemplate.yml&stackName=honeycode-export)

Then click the above link to deploy the stack to your environment. If you prefer, you can also manually upsert the [template.yml](https://github.com/iann0036/honeycode-export/blob/master/template.yml) stack from source.

You will need to provide the Workbook ID and Sheet ID which can be found in the URL bar, or via the [modal](https://docs.aws.amazon.com/honeycode/latest/UserGuide/arns-and-ids.html). You will also need to specify the export frequency, if periodic export is desired.

Once launched, the CloudFormation stack will output the name of an S3 bucket it has created, which will be the destination bucket for exported table data.
