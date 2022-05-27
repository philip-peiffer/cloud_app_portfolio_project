const express = require('express')
const model = require('../model')
const messages = require('./errorMessages')
const googleOAuthClient = require('./googleAuthClient')

const gear = express.Router()

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

function updateUserRentalsArray(userId, rentalId, rentalName) {
    const existUserArray = await model.getItem('users', userId, true)
    const existUser = existUserArray[0]

    existUser.rentals.forEach(rental => {
        if (rental.id === rentalId) {
            rental.name = rentalName
        }
    })
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

    existGear.rental = null
    await model.updateItem(existGear, 'gear')
}

/*--------------- Middleware Functions --------------------- */


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
        res.status(400).send(messages[400].badKeys)
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

/*------------------ Gear ROUTES --------------------------- */

gear.post('/', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, async (req, res) => {
    // verify request body values -- assuming they're OK per allowed course instructions
    req.body.rental = null
    const createdGear = await model.postItem(req.body, 'gear')
    addSelftoResponseObject(req, createdGear)

    res.status(201).send(createdGear)
})

gear.get('/', verifyAcceptHeader, verifyJWT, async (req, res) => {
    // return a list of all rentals tied to the user identified in the JWT
    const response = await model.getFilteredItems('rentals', 'user', req.body.user)

    // loop through response and add self to each response object
    response.forEach(rental => {
        addSelftoResponseObject(req, rental)
    })
    res.status(200).send(response)
})

gear.delete('/', methodNotAllowed)
gear.put('/', methodNotallowed)
gear.patch('/', methodNotAllowed)

gear.put('/:rental_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, verifyResourceExists, verifyUserOwnsResource, prepareReqBodyPutPatch, async (req, res) => {
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

gear.patch('/:rental_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyJWT, verifyResourceExists, verifyUserOwnsResource, prepareReqBodyPutPatch, async (req, res) => {
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

gear.delete('/:rental_id', verifyJWT, verifyResourceExists, verifyUserOwnsResource, async (req, res) => {
    // NOTE - deleting a rental also deletes it out of the user's array and removes tie to gear as well
    req.body.existResource.gear.forEach(piece => {
        removeRentalFromGear(piece.id)
    })

    removeRentalFromUser(req.body.existResource.user, req.params.rental_id)

    await model.deleteItem('rentals', req.params.rental_id)
    res.status(204).end()
})

module.exports = gear