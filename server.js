const express = require('express')
const bodyParser = require('body-parser')

const app = express()

// tell express to parse all incoming bodies as JSON, send custom error message if not JSON
app.use(bodyParser.json())
app.use((err, req, res, next) => {
    if (err) {
        console.error(err)
        res.status(400).send({"Error": "Problem with JSON format in body"})
    } else {
        next()
    }
})


