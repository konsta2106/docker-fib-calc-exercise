const keys = require('./keys')
const redis = require('redis')
const pg = require('pg')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

//Express App Setup
const app = express()
app.use(cors())
app.use(bodyParser.json())

//Postgres CLient Setup
const { Pool } = require('pg')
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
})
pgClient.on('error', () => console.log('Lost PG connection'))

pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => {
        console.log(err)
    })

//Redis Client Setup
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
})
const redisPublisher = redisClient.duplicate()
let counter = 0
//Express routes
app.get('/', (req, res) => {
    counter = counter + 1
    let response = {
        counter: counter
    }
    res.send(response)
})

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values')
    res.send(values.rows)
})

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values)
    })
})

app.post('/values', async (req, res) => {
    const index = req.body.index

    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high')
    }

    redisClient.hset('values', index, 'Nothing yet')
    redisPublisher.publish('insert', index)
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

    res.send({ working: true })
})

app.listen(5000, () => {
    console.log('Listening')
})