# Express Typescript Prisma Server Starter

#### Local Setup

1. Download and configure AWS.

```
aws configure
```

2. Install dependencies:

```
yarn
```

3. Fetch local environment variables

```
yarn fetch-env local
```

4. Download and configure PostgreSQL

- install postgresql

```
brew install postgresql
```

- open postgres cli

```
psql postgres
```

- create postgres user

```
CREATE USER root SUPERUSER;
```

- create dev db

```
CREATE DATABASE guardian;
```

#### Standing up the api

1.  Generate Nexus & Prisma types:

```
yarn run generate
```

2. Set up local postgres database: migrate types and generate schema:

```
yarn run db:push
```

3. Start development server (in 2 separate terminals)

```
yarn run build:watch
yarn run start:dev       ### or yarn run start:dev:local after setting up variables in .env.local
```
