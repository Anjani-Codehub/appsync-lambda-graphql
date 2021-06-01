'use strict';

const fs = require('fs')
const { ApolloServer, gql } = require('apollo-server-lambda')
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
// get the GraphQL schema
const schema = fs.readFileSync('./src/schema.graphql', 'utf8')

exports.graphqlHandler = async function(event) {

  console.log('Request event: ', event);

  if (!event) throw new Error('Event not found');

  let response;
  switch(true) {
    case event.httpMethod === 'POST':
      response = await saveProduct(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH':
      const requestBody = JSON.parse(event.body);
      response = await modifyProduct(requestBody.id, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE':
      response = await deleteProduct(JSON.parse(event.body).productId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function saveProduct(requestBody) {
  const params = {
    TableName: process.env.MERCHANTS_DDB_TABLE,
    Item: requestBody
  }
  return await dynamodb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Error Occured while Saving the record: ', error);
  })
}

async function modifyProduct(id, updateKey, updateValue) {
  const params = {
    TableName: process.env.MERCHANTS_DDB_TABLE,
    Key: {
      'id': id
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue
    },
    ReturnValues: 'UPDATED_NEW'
  }
  return await dynamodb.update(params).promise().then((response) => {
    const body = {
      Operation: 'UPDATE',
      Message: 'SUCCESS',
      UpdatedAttributes: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Error Occured while Modifying the record: ', error);
  })
}

async function deleteProduct(id) {
  const params = {
    TableName: process.env.MERCHANTS_DDB_TABLE,
    Key: {
      'id': id
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamodb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Error Occured while Deleting the record: ', error);
  })
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

// resolver functions
const resolvers = { 
  Query: {
    item: () => {},
  },

  Mutation: {
    createItem: () => {},
  }
};

const server = new ApolloServer({ typeDefs: schema, resolvers })

// launch the server when the Lambda is called
exports.handler = server.createHandler();
