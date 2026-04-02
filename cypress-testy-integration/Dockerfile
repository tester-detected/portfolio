FROM cypress/included:14.5.4

WORKDIR /e2e

# Copy package.json and install dependencies (Cypress 14.5.4 is already in the image)
COPY package.json package-lock.json* ./
RUN sed -i 's/"cypress": "[^"]*"/"cypress": "14.5.4"/' package.json && \
    npm install --legacy-peer-deps --ignore-scripts

# Copy the rest of the project files
COPY . .

# Run tests in headless mode by default
ENTRYPOINT ["npx", "cypress", "run"]
CMD ["--config-file", "cypress.config.server.js"]
