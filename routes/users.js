const express = require('express')
const {google} = require('googleapis')
const model = require('../model')
const messages = require('./errorMessages')

// define google OAuth values that identify application and scope of authorization
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECTS = process.env.REDIRECTS

// initialize an Oauth2.0 client for google Oauth2.0 calls
const googleOAuthClient = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECTS  
)

const router = express.Router()

// body-parser already used at the top app level

/*--------------- Middleware Functions --------------------- */
async function verifyJWT (req, res, next) {
    const response = await googleOAuthClient.verifyIdToken({
        idToken: req.body.token,
        audience: CLIENT_ID
    })

    console.log(response)
}

function verifyContentTypeHeader (req, res, next) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send(messages[415])
    } else {
        next()
    }
}

function verifyAcceptHeader (req, res, next) {
    const headerVal = req.get('accept')
    if (headerVal !== 'application/json' && headerVal !== '*/*') {
        res.status(406).send(messages[406])
    } else {
        next()
    }
}

function verifyRequestBodyKeys (req, res, next) {
    const requiredKeys = ["First Name", "Last Name", "Date Created", "id", "rentals"]
    const request = req.body
    let valid = true

    if (requiredKeys.length !== Object.keys(request).length) {
        valid = false
    }

    if (valid) {
        requiredKeys.forEach(key => {
            if (!(key in request)) {
                valid = false
            }
        })
    }

    if (valid) {
        next()
    } else {
        res.status(404).send(messages[404].badKeys)
    }
}

function verifyRequestBodyVals (req, res, next) {
    
}

function methodNotAllowed (req, res) {
    res.status(405).setHeader('Allow', ["GET", "POST"]).end()
}


/*------------------ USERS ROUTES --------------------------- */
router.post('/', verifyContentTypeHeader, verifyAcceptHeader, verifyJWT, verifyRequestBodyKeys, (req, res) => {
    // verify request body values
    // post item

})

router.get('/', verifyAcceptHeader, (req, res) => {
    // return a list of all users, regardless if JWT was passed
    const response = await model.getItems('users')
    res.status(200).send(response)
})

router.put('/', methodNotAllowed)

router.patch('/', methodNotAllowed)

router.delete('/', methodNotAllowed)

module.exports = router