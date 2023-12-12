Info
===
index.js is the Lambda function
index-streamify.js is a Lambda streaming function that always times out.

Memory settings should be 2048MB or higher

Returns base64 encoded PDF data - a constraint of Lambda.
Binary PDF data can be returned from API Gateway:
"For Lambda proxy integrations with API Gateway, base64 encode the binary data in the Lambda function response. You will also need to configure the API's binary media types."

Or write binary PDF data to S3 and return the S3 object URL in the response.

Make Lambda layer package containing Puppeteer:
===
Use "Chromium for Serverless platforms" https://github.com/Sparticuz/chromium/

Use correct Puppeteer/Chromium version combination as per https://pptr.dev/chromium-support

Project was initialized with PUPPETEER_VERSION=21.5.0, CHROMIUM_VERSION=119
npm install --save puppeteer-core@$PUPPETEER_VERSION
npm install --save-dev @sparticuz/chromium@$CHROMIUM_VERSION

Lambda layers for Node.js expect a zip file with the folder "nodejs" under which there is the "node_modules" directory with dependencies.
The layers zip file (~60MB) should be uploaded to S3 and when creating the layer in AWS console, fetch from S3.
Create an S3 bucket like "html-pdf-lambda-<randomnumber>" with a prefix "layer-deps".

    npm install
    mkdir -p nodejs/node_modules
    cp -a node_modules/* nodejs/node_modules
    zip -r lambda-layer.zip nodejs
    aws s3 cp lambda-layer.zip s3://html-pdf-lambda-<randomnumber>/layer-deps/lambda-layer.zip


Create the Lambda layer
===
Lambda -> Add Layer -> Create a Layer
Runtime: Node.js 18.x
name: "Puppeteer-deps"
From S3: s3://html-pdf-lambda-<randomnumber>/layer-deps/lambda-layer.zip

Add Layer to function
===
Choose a Layer: "Custom Layes"
Select "Puppeteer-deps" from dropdown "Your Layers"; version 1.


Create the Lambda function
===
N.B.: use Node.js v18, not v20 (missing shared libraries in Puppeteer)

Call the Lambda directly through Lambda URL
===

    curl -H'content-type:application/json'  https://<id>.lambda-url.eu-central-1.on.aws -d '<html><body>Hi</body></html> --output /tmp/out.base64 && base64 -d /tmp/out.base64 > /tmp/out.pdf

or

    curl -H'content-type:application/json'  https://<id>.lambda-url.eu-central-1.on.aws --data-binary=@/tmp/in.html --output /tmp/out.base64 && base64 -d /tmp/out.base64 > /tmp/out.pdf

Lambda function will return only a base64 encoded payload, so it needs to be decoded client side.

Call Lambda function through API Gateway
===
# Configuration: timeout to at least 20s

Lambda function expects JSON encoded event data, not binary, it's not possible to give it a binary payload from API Gateway.
Convert client HTML data to the JSON that the Lambda function expects in Integration Request Mapping Template for "text/html" Content Type:

    {
    "body" : "$util.base64Encode($input.body)",
    "isBase64Encoded": true,
    ...
    }

Lambda function decodes event.body from base64 to plain text.
Lambda function returns PDF data base64 encoded.
API Gateway in Integration Response "Content Handling" with "Convert to binary" setting and sets the "content-type" of the response to whatever the client wants in their "accept:" header.

Example call:

    curl -i  -X POST -H'content-type:text/html' -H'accept:application/pdf' https://<...>.execute-api.eu-central-1.amazonaws.com/test -d '<body>HEY</body>' --output out.pdf
    

    
Integration Reponse
Name Mapping value
method.response.header.Content-Type	'application/pdf'
