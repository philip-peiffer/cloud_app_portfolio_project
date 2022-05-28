const express = require('express')
const model = require('../model')
const messages = require('./errorMessages')
const googleOAuthClient = require('./googleAuthClient')

const router = express.Router()

// body-parser already used at the top app level

function newUser (decodedJWT) {
    let date = new Date()
    const [month, day, year] = [date.getMonth() + 1, date.getDate(), date.getFullYear()]

    const newUser = {
        "First Name": decodedJWT.payload.given_name,
        "Last Name": decodedJWT.payload.family_name,
        "Date Created": `${month}/${day}/${year}`,
        "id": decodedJWT.payload.sub
    }

    return newUser
}

/*--------------- Middleware Functions --------------------- */
async function verifyJWT (req, res, next) {
    let token = req.get('authorization')
    
    try {
        const response = await googleOAuthClient.verifyIdToken({
            idToken: token.slice(7),
            audience: process.env.CLIENT_ID
        })

        req.body = newUser(response)
        next()
    }
    catch (err) {
        console.error(err)
        res.status(401).send(messages[401])
    }
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
    const requiredKeys = ["First Name", "Last Name", "Date Created", "id"]
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
        res.status(400).send(messages[400].badKeys)
    }
}

function methodNotAllowed (req, res) {
    res.status(405).setHeader('Allow', ["GET", "POST"]).end()
}


/*------------------ USERS ROUTES --------------------------- */
router.post('/', verifyContentTypeHeader, verifyAcceptHeader, verifyJWT, verifyRequestBodyKeys, async (req, res) => {
    // verify request body values -- assuming they're OK per allowed course instructions
    req.body.rentals = []
    const id = req.body.id
    delete req.body.id
    const response = await model.postItemManId(req.body, id, 'users')
    res.status(201).send(response)
})

router.get('/', verifyAcceptHeader, async (req, res) => {
    // return a list of all users, regardless if JWT was passed
    const response = await model.getItemsNoPaginate('users', true)
    res.status(200).send(response)
})

router.put('/', methodNotAllowed)

router.patch('/', methodNotAllowed)

router.delete('/', methodNotAllowed)

module.exports = router