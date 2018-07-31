## Build Environment
# The latest LTS version of node
FROM node:carbon-alpine as builder

# Create app directory
WORKDIR /usr/src/app

ENV PKG_TARGET="node8-linux-x64"

# Add app
COPY . .

# Install pkg
RUN yarn global add pkg

# Install app dependencies
RUN yarn install --silent
 # Test app
RUN yarn test

# Build app
RUN yarn build

## Prod Environment
FROM node:carbon

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/build/lightapp2-server /usr/src/app

# Make port 4001 available to the world outside this container
EXPOSE 4001

# Start the app
CMD ./lightapp2-server