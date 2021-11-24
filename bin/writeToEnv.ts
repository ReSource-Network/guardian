// eslint-disable-next-line @typescript-eslint/no-var-requires
const envFile = require("fs").createWriteStream(".env")

const dataFromParamStore = JSON.parse(process.argv[2])

const parameters = dataFromParamStore.Parameter.Value

envFile.write(parameters)
