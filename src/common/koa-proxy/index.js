/*
 * Copyright 2016-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file.
 * This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
'use strict'
const http = require('http')

//DONE
function removeStageFromPath(path) {
    if (path) {
        var pathParts = path.split("/");
        var index = pathParts.indexOf(Configuration.deployedStage);
        if (index < 0) {
            return path;
        }
        pathParts = pathParts.splice(index + 1, pathParts.length);
        return "/" + pathParts.join("/");
    }
    return path;
}
//DONE
function getPathWithQueryStringParams(event) {
    var transformedPath = this.removeStageFromPath(event.path);
    const queryStringKeys = Object.keys(event.queryStringParameters || {});
    if (queryStringKeys.length === 0) {
        return transformedPath;
    };
    const queryStringParams = queryStringKeys.map(queryStringKey => `${queryStringKey}=${event.queryStringParameters[queryStringKey]}`).join("&");

    return `${transformedPath}?${queryStringParams}`;
}

//DONE
function mapApiGatewayEventToHttpRequest(event, context, socketPath) {
    const headers = event.headers || {} // NOTE: Mutating event.headers; prefer deep clone of event.headers
    const eventWithoutBody = Object.assign({}, event)
    delete eventWithoutBody.body

    headers['x-apigateway-event'] = JSON.stringify(eventWithoutBody)
    headers['x-apigateway-context'] = JSON.stringify(context)

    return {
        method: event.httpMethod,
        path: getPathWithQueryStringParams(event),
        headers,
        socketPath
        // protocol: `${headers['X-Forwarded-Proto']}:`,
        // host: headers.Host,
        // hostname: headers.Host, // Alias for host
        // port: headers['X-Forwarded-Port']
    }
}

//DONE
function forwardResponseToApiGateway(server, response, context) {
    let body = ''

    response.setEncoding('utf8')
        .on('data', (chunk) => body += chunk.toString('utf8'))
        .on('end', () => {
            const statusCode = response.statusCode
            const headers = response.headers

            Object.keys(headers)
                .forEach(h => {
                    if (Array.isArray(headers[h]))
                        headers[h] = headers[h].join(',')
                })
            const successResponse = { statusCode, body, headers }
            context.succeed(successResponse)
        })
}

//DONE
function forwardConnectionErrorResponseToApiGateway(server, error, context) {
    console.error(error)
    const errorResponse = {
        statusCode: 502, // "DNS resolution, TCP level errors, or actual HTTP parse errors" - https://nodejs.org/api/http.html#http_http_request_options_callback
        body: '',
        headers: {}
    }

    context.succeed(errorResponse)
}

function forwardLibraryErrorResponseToApiGateway(server, error, context) {
    console.error(error)
    const errorResponse = {
        statusCode: 500,
        body: '',
        headers: {}
    }

    context.succeed(errorResponse)
}

//DONE
function forwardRequestToNodeServer(server, event, context) {
    const requestOptions = mapApiGatewayEventToHttpRequest(event, context, getSocketPath(server._socketPathSuffix))
    const req = http.request(requestOptions, (response) => forwardResponseToApiGateway(server, response, context))
    if (event.body) {
        req.write(event.body)
    }
    req.on('error', (error) => forwardConnectionErrorResponseToApiGateway(server, error, context))
        .end()
}

//DONE
function startServer(server) {
    return server.listen(getSocketPath(server._socketPathPrefix, server._socketPathSuffix))
}

//DONE
function getSocketPath(socketPathPrefix, socketPathSuffix) {
    return `/tmp/server${socketPathPrefix}-${socketPathSuffix}.sock`
}

//DONE
exports.createServer = (socketPathPrefix, requestListener, serverListenCallback) => {
    const server = http.createServer(requestListener)

    server._socketPathSuffix = 0;
    server._socketPathPrefix = socketPathPrefix;
    server.on('listening', () => {
        server._isListening = true
        if (serverListenCallback) serverListenCallback()
    })
    server.on('close', () => {
        server._isListening = false
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`EADDRINUSE ${getSocketPath(server._socketPathSuffix)} incrementing socketPathSuffix.`)
            ++server._socketPathSuffix
            server.close(() => startServer(server))
        }
    })

    return server
}

//DONE
exports.proxy = (server, event, context) => {
    try {
        if (server._isListening) {
            forwardRequestToNodeServer(server, event, context)
        } else {
            startServer(server)
                .on('listening', () => {
                    try {
                        forwardRequestToNodeServer(server, event, context)
                    } catch (error) {
                        forwardLibraryErrorResponseToApiGateway(server, error, context)
                    }
                })
        }
    } catch (error) {
        forwardLibraryErrorResponseToApiGateway(server, error, context)
    }
}

if (process.env.NODE_ENV === 'test') {
    exports.getPathWithQueryStringParams = getPathWithQueryStringParams
    exports.mapApiGatewayEventToHttpRequest = mapApiGatewayEventToHttpRequest
    exports.forwardResponseToApiGateway = forwardResponseToApiGateway
    exports.forwardConnectionErrorResponseToApiGateway = forwardConnectionErrorResponseToApiGateway
    exports.forwardLibraryErrorResponseToApiGateway = forwardLibraryErrorResponseToApiGateway
    exports.forwardRequestToNodeServer = forwardRequestToNodeServer
    exports.startServer = startServer
    exports.getSocketPath = getSocketPath
}