const express = require('express')
const model = require('../model')
const errorMessages = require('./errorMessages')
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
    addObj.self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + addObj.id
}

/**
 * This function looks up the rental tied to a piece of gear and updates the rental array to include a new item description
 * for that piece of gear. Use this function if the item description changes during PUT or PATCH requests.
 * @param {str} rentalId 
 * @param {str} gearId 
 * @param {str} gearDescription 
 */
async function updateRentalsGearArray(rentalId, gearId, gearDescription) {
    const existRentalArray = await model.getItem('rentals', rentalId)
    const existRental = existRentalArray[0]

    existRental.gear.forEach(piece => {
        if (piece.id === gearId) {
            piece["item description"] = gearDescription
        }
    })
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
    const allowedObj = {"item description": '', "category": ''}
    let requiredKeys;
    let valid = true

    if (req.method === "PUT" || req.method === "POST") {
        requiredKeys = ['item description', 'category']
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
    const resource = await model.getItem('gear', req.params.gear_id, false)
    if (resource[0] === null || resource[0] === undefined) {
        res.status(404).send(errorMessages[404].gear)
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
    req.body.available = true
    const createdGear = await model.postItem(req.body, 'gear')
    addSelftoResponseObject(req, createdGear)

    res.status(201).send(createdGear)
})

gear.get('/', verifyAcceptHeader, async (req, res) => {
    // return a list of all gear (not protected), paginated to 5 results per page
    let cursorToken = req.query.token
    if (cursorToken !== null && cursorToken !== undefined) {
        cursorToken = decodeURIComponent(cursorToken)
    }
    const response = await model.getItemsPaginate('gear', cursorToken)

    // loop through response and add self to each response object
    response.gear.forEach(gearPiece => {
        addSelftoResponseObject(req, gearPiece)
    })

    // fix "next" attribute to have correct endpoint
    const baseUrl = req.protocol + '://' + req.get('host') + req.baseUrl + '?token='
    cursorToken = response.next
    if (cursorToken !== null) {
        response.next = baseUrl + encodeURIComponent(cursorToken)
    } 

    res.status(200).send(response)
})

gear.delete('/', methodNotAllowed)
gear.put('/', methodNotAllowed)
gear.patch('/', methodNotAllowed)

gear.get('/:gear_id', verifyAcceptHeader, verifyResourceExists, async (req, res) => {
    const resource = req.body.existResource
    addSelftoResponseObject(req, resource)
    res.status(200).send(resource)

})

gear.put('/:gear_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyResourceExists, prepareReqBodyPutPatch, async (req, res) => {
    const existResource = req.body.existResource
    delete req.body.existResource

    // update gear and prepare it for sending back
    const response = await model.updateItem(req.body, 'gear')
    addSelftoResponseObject(req, response)

    // update the rental's gear array if gear is tied to a rental and description changed
    if (response["item description"] !== existResource["item description"] && response.rental !== null) {
        updateRentalsGearArray(response.rental, response.id, response["item description"])
    }
    res.status(303).set('location', response.self).end()
})

gear.patch('/:gear_id', verifyContentTypeHeader, verifyAcceptHeader, verifyRequestBodyKeys, verifyResourceExists, prepareReqBodyPutPatch, async (req, res) => {
    const existResource = req.body.existResource
    delete req.body.existResource

    // update gear and prepare it for sending back
    const response = await model.updateItem(req.body, 'gear')
    addSelftoResponseObject(req, response)

    // update the rental's gear array if gear is tied to a rental and description changed
    if (response["item description"] !== existResource["item description"] && response.rental !== null) {
        updateRentalsGearArray(response.rental, response.id, response["item description"])
    }
    res.status(303).set('location', response.self).end()
})

// gear.delete('/:rental_id', verifyJWT, verifyResourceExists, verifyUserOwnsResource, async (req, res) => {
//     // NOTE - deleting a rental also deletes it out of the user's array and removes tie to gear as well
//     req.body.existResource.gear.forEach(piece => {
//         removeRentalFromGear(piece.id)
//     })

//     removeRentalFromUser(req.body.existResource.user, req.params.rental_id)

//     await model.deleteItem('rentals', req.params.rental_id)
//     res.status(204).end()
// })

module.exports = gear