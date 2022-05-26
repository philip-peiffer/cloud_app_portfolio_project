const express = require('express')
const model = require('../model')
const messages = require('./errorMessages')
const googleOAuthClient = require('./googleAuthClient')

const rentals = express.Router()

// body-parser already used at the top app level

/*--------------- Helper Functions --------------------- */

/**
 * This function requires the request object as input in order to extract the proper URL. It also requires the object that is
 * being sent in the response body as input so that it can be modified to add "self" to the object.
 * @param {*} req 
 * @param {*} addObj 
 */
 function addSelftoResponseObject (req, addObj) {
    addObj.self = req.protocol + '://' + req.get('host') + req.basUrl + '/' + req.body.id
}

function removeRentalFromUser (userId, rentalId) {
    const existUserArray = await model.getItem('users', userId, true)
    const existUser = existUserArray[0]

    const newRentals = []
    existUser.rentals.forEach(rental => {
        if (rental.id !== rentalId) {
            newRentals.push(rental)
        }
    })
    existUser.rentals = newRentals

    await model.updateItem(existUser, 'users', true)
}

function removeRentalFromGear (gearId) {
    const existGearArray = await model.getItem('gear', gearId)
    const existGear = existGearArray[0]

    existGear.rentals = null
    await model.updateItem(existGear, 'gear')
}

/*--------------- Middleware Functions --------------------- */

/** 
*   Verifies the JWT sent with the request. If JWT is invalid or not sent, sends a 401 code/error message. If JWT is valid, 
*   adds "user" to the request body with value = JWT.sub and passes control to next middleware.
*/
async function verifyJWT (req, res, next) {
    let token = req.get('authorization')
    
    try {
        const response = await googleOAuthClient.verifyIdToken({
            idToken: token.slice(7),
            audience: process.env.CLIENT_ID
        })

        req.body.user = response.payload.sub
        next()
    }
    catch (err) {
        console.error(err)
        res.status(401).send(messages[401])
    }
}

/** 
 * Verifies the content-type header of the request is application/json. If not, it sends a 415 status code/error message. If it is
 * then passes along to next middleware function.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
*/
function verifyContentTypeHeader (req, res, next) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send(messages[415])
    } else {
        next()
    }
}

/**
 * Verifies that the "accept" header of the request is application/json. If not, it sends a 406 status code/error message. If it is
 * then it passes control to next middleware function.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function verifyAcceptHeader (req, res, next) {
    const headerVal = req.get('accept')
    if (headerVal !== 'application/json' && headerVal !== '*/*') {
        res.status(406).send(messages[406])
    } else {
        next()
    }
}

/**
 * Verifies that the request body does not contain extraneous attributes or leaves out any required attributes. If request body is 
 * valid, passes control onto next function. Otherwise, sends a 400 status with an error message about bad keys.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function verifyRequestBodyKeys (req, res, next) {
    const requiredKeys = ["start", "end"]
    const allowedObj = {"start": '', "end": '', "name": ''}
    const request = req.body
    let valid = true

    // check to make sure no extra attributes beyond what's allowed are added to request body
    Object.keys(request).forEach(key => {
        if (!(key in allowedObj)) {
            valid = false
        }
    })
    
    // if still valid, check to make sure required keys have been passed to request body
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

/**
 * Verifies that the user requesting action via a JWT owns the resource being requested. NOTE - this middleware must
 * come after verifyResourceExists and verifyJWT, as they perform actions that this middleware depends on. If the user 
 * requesting action does not match the current owner of the resource, a 403 status/error message is returned.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
async function verifyUserOwnsResource (req, res, next) {
    // existing resource is stored in the body of the request at this point (after verifyResourceExists)
    if (req.body.existResource !== req.body.user) {
        res.status(403).send(errorMessages[403])
    } else {
        next()
    }
}

/**
 * Verifies that the resource on which action is requested actually exists. If it does exist, the existing resource is
 * added to the request body as existResource and passes control to next middleware. If it doesn't exist, a 404 status/
 * error message is returned.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
async function verifyResourceExists (req, res, next) {
    const {resourceId} = req.params

    const resource = await model.getItem('rentals', resourceId, false)
    if (resource[0] === null || resource[0] === undefined) {
        res.status(404).send(errorMessages[404].rentals)
    } else {
        req.body.existResource = resource[0]
        next()
    }
}

/**
 * Middleware to use when a method is not allowed. Sends a 405 status code with the allowed methods set in the header.
 * @param {*} req 
 * @param {*} res 
 */
function methodNotAllowed (req, res) {
    res.status(405).setHeader('Allow', ["GET", "POST"]).end()
}

/*------------------ Rentals ROUTES --------------------------- */

rentals.post('/', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, async (req, res) => {
    // verify request body values -- assuming they're OK per allowed course instructions
    req.body.gear = []
    const createdRental = await model.postItem(req.body, 'rentals')

    // add "self" to response and add rental to user
    addSelftoResponseObject(req, createdRental)
    const user = await model.getItem('users', createdRental.user, true)
    user[0].rentals.push({"id": createdRental.id, "self": createdRental.self})
    await model.updateItem(user[0], 'users', true)

    res.status(201).send(createdRental)
})

rentals.get('/', verifyAcceptHeader, verifyJWT, async (req, res) => {
    // return a list of all rentals tied to the user identified in the JWT
    const response = await model.getFilteredItems('rentals', 'user', req.body.user)

    // loop through response and add self to each response object
    response.forEach(rental => {
        addSelftoResponseObject(req, rental)
    })
    res.status(200).send(response)
})

rentals.put('/:rental_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, verifyResourceExists, verifyUserOwnsResource, async (req, res) => {
    // add the existing gear and id to the rental
    const existGear = req.body.existResource.gear
    delete req.body.existResource
    req.body.gear = existGear
    req.body.id = req.params.rental_id

    const response = await model.updateItem(req.body, 'rentals')
    addSelftoResponseObject(req, response)
    res.status(303).set('location', response.self).end()
})

rentals.patch('/:rental_id', methodNotAllowed)

rentals.delete('/:rental_id', verifyJWT, verifyResourceExists, verifyUserOwnsResource, async (req, res) => {
    // NOTE - deleting a rental also deletes it out of the user's array and removes tie to gear as well
    req.body.existResource.gear.forEach(piece => {
        removeRentalFromGear(piece.id)
    })

    removeRentalFromUser(req.body.existResource.user, req.params.rental_id)

    await model.deleteItem('rentals', req.params.rental_id)
    res.status(204).end()
})

rentals.delete('/', methodNotAllowed)

module.exports = rentals