# Base image
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application using ts-node/esm (as per package.json)
CMD ["npm", "run", "start:docker"]
