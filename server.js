const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()
const login = require('./routes/login')
const users = require('./routes/users')
const gear = require('./routes/gear')
const rentals = require('./routes/rentals')
const gearRentalRelationship = require('./routes/gearRentalRelationships')

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

app.use('/', login)
app.use('/users', users)
app.use('/gear', gear)
app.use('/rentals', rentals)
app.use('/rentals', gearRentalRelationship)


// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
