const express = require('express')
const model = require('../model')
const errorMessages = require('./errorMessages')
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
    addObj.self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + addObj.id
}

async function updateUserRentalsArray(userId, rentalId, rentalName) {
    const existUserArray = await model.getItem('users', userId, true)
    const existUser = existUserArray[0]

    existUser.rentals.forEach(rental => {
        if (rental.id === rentalId) {
            rental.name = rentalName
        }
    })
}

async function removeRentalFromUser (userId, rentalId) {
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

async function removeRentalFromGear (gearId) {
    const existGearArray = await model.getItem('gear', gearId)
    const existGear = existGearArray[0]

    existGear.rental = null
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
        res.status(401).send(errorMessages[401])
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
        res.status(415).send(errorMessages[415])
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
        res.status(406).send(errorMessages[406])
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
    const allowedObj = {"start": '', "end": '', "name": ''}
    let requiredKeys;
    let valid = true

    if (req.method === "PUT" || req.method === "POST") {
        requiredKeys = ["start", "end"]
    } else {
        requiredKeys = []
    }
    
    // check to make sure no extra attributes beyond what's allowed are added to request body
    Object.keys(req.body).forEach(key => {
        if (!(key in allowedObj)) {
            valid = false
        }
    })
    
    // if still valid, check to make sure required keys have been passed to request body
    if (valid) {
        requiredKeys.forEach(key => {
            if (!(key in req.body)) {
                valid = false
            }
        })
    }

    if (valid) {
        next()
    } else {
        res.status(400).send(errorMessages[400].badKeys)
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
    if (req.body.existResource.user !== req.body.user) {
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
    const resourceId = req.params.rental_id

    const resource = await model.getItem('rentals', resourceId, false)
    if (resource[0] === null || resource[0] === undefined) {
        res.status(404).send(errorMessages[404].rentals)
    } else {
        req.body.existResource = resource[0]
        next()
    }
}

/**
 * Prepares the request body for being passed into the update function on PUT and PATCH request. The function
 * loops through the existing representation of the resource and adds the existing id, user, gear (for PUT) and
 * any non-included attributes for PATCH.
 * NOTE - request body must contain a key existResource that contains the current representation of the resource 
 * before update.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function prepareReqBodyPutPatch (req, res, next) {
    const existResource = req.body.existResource
    Object.keys(existResource).forEach(key => {
        if (!(key in req.body)) {
            req.body[key] = existResource[key]
        }
    })
    next()
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
    user[0].rentals.push({"id": createdRental.id, "self": createdRental.self, "name": createdRental.name})
    await model.updateItem(user[0], 'users', true)

    res.status(201).send(createdRental)
})

rentals.get('/', verifyAcceptHeader, verifyJWT, async (req, res) => {
    // return a list of all rentals tied to the user identified in the JWT
    let cursorToken = req.query.token
    if (cursorToken === null || cursorToken === undefined) {
        cursorToken = undefined
    } else {
        cursorToken = decodeURIComponent(cursorToken)
    }
    const response = await model.getFilteredItemsPaginated('rentals', 'user', req.body.user, cursorToken)

    // loop through response and add self to each response object
    response.rentals.forEach(rental => {
        addSelftoResponseObject(req, rental)
    })

    // fix "next" attribute to have correct endpoint
    const baseUrl = req.protocol + '://' + req.get('host') + req.baseUrl + '?token='
    cursorToken = response.next
    if (cursorToken === null || cursorToken === undefined) {
        res.status(200).send(response)
    } else {
        cursorToken = encodeURIComponent(cursorToken)
        response.next = baseUrl + cursorToken
        res.status(200).send(response)
    }
})

rentals.get('/:rental_id', verifyAcceptHeader, verifyJWT, verifyResourceExists, verifyUserOwnsResource, async (req, res) => {
    const resource = req.body.existResource
    addSelftoResponseObject(req, resource)
    res.status(200).send(resource)
})

rentals.put('/:rental_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, verifyResourceExists, verifyUserOwnsResource, prepareReqBodyPutPatch, async (req, res) => {
    const existResource = req.body.existResource
    delete req.body.existResource

    // update rental and prepare it for sending back
    const response = await model.updateItem(req.body, 'rentals')
    addSelftoResponseObject(req, response)

    // update the user's rental array that is tied to the rental if rental name changed
    if (response.name !== existResource.name) {
        updateUserRentalsArray(response.user, response.id, response.name)
    }
    res.status(303).set('location', response.self).end()
})

rentals.patch('/:rental_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, verifyResourceExists, verifyUserOwnsResource, prepareReqBodyPutPatch, async (req, res) => {
    const existResource = req.body.existResource
    delete req.body.existResource

    // update rental and prepare it for sending back
    const response = await model.updateItem(req.body, 'rentals')
    addSelftoResponseObject(req, response)

    // update the user's rental array that is tied to the rental if rental name changed
    if (response.name !== existResource.name) {
        updateUserRentalsArray(response.user, response.id, response.name)
    }
    res.status(303).set('location', response.self).end()
})

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