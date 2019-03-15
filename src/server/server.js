"use strict";
const typeDefs = require("./typeDefs");
const resolvers = require("./resolvers");
const { ApolloServer } = require("apollo-server-express");
const http = require("http"); // Library to create an http server
const express = require("express"); // NodeJS Web Server
const cors = require("cors"); // Cross Origin Resource Sharing Middleware
const helmet = require("helmet"); // Security Middleware
const compression = require("compression"); // Compression Middleware

class Server {
  constructor(lightService) {
    // Define and Apply middleware to Express app
    const app = express();
    app.use("*", cors());
    app.use(helmet());
    app.use(compression());

    const context = async ({ req }) => ({
      lightService,
      request: req
    });
    const apolloServer = new ApolloServer({ typeDefs, resolvers, context });
    apolloServer.applyMiddleware({ app });

    // Create the httpServer and add subscriptions
    this.server = http.createServer(app);
    apolloServer.installSubscriptionHandlers(this.server);

    this.graphqlPath = apolloServer.graphqlPath;
    this.subscriptionsPath = apolloServer.subscriptionsPath;
  }

  start(port) {
    return new Promise(resolve => {
      this.server.listen(port, resolve);
    });
  }
}

module.exports = Server;
