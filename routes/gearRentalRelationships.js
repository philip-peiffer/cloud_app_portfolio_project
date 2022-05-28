const express = require('express')
const model = require('../model')
const errorMessages = require('./errorMessages')
const googleOAuthClient = require('./googleAuthClient')

const router = express.Router()


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
 * Verifies that the user requesting action via a JWT owns the rental being requested. NOTE - this middleware must
 * come after verifyResourceExists and verifyJWT, as they perform actions that this middleware depends on. If the user 
 * requesting action does not match the current owner of the resource, a 403 status/error message is returned.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
 async function verifyUserOwnsRental (req, res, next) {
    // existing resource is stored in the body of the request at this point (after verifyResourceExists)
    if (req.body.existRental.user !== req.body.user) {
        res.status(403).send(errorMessages[403])
    } else {
        next()
    }
}

/**
 * Verifies that the rental on which action is requested actually exists. If it does exist, the existing rental is
 * added to the request body as existRental and passes control to next middleware. If it doesn't exist, a 404 status/
 * error message is returned.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
async function verifyRentalExists (req, res, next) {
    const resourceId = req.params.rental_id

    const resource = await model.getItem('rentals', resourceId, false)
    if (resource[0] === null || resource[0] === undefined) {
        res.status(404).send(errorMessages[404].rentals)
    } else {
        req.body.existRental = resource[0]
        next()
    }
}

/**
 * Verifies that the gear on which action is requested actually exists. If it does exist, the existing gear is 
 * added to the request body as existGear and passes control to next middleware. 
 * If it doesn't exist, a 404 status/error message is returned.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
 async function verifyGearExists (req, res, next) {
    const resourceId = req.params.gear_id

    const resource = await model.getItem('gear', resourceId, false)
    if (resource[0] === null || resource[0] === undefined) {
        res.status(404).send(errorMessages[404].gear)
    } else {
        req.body.existGear = resource[0]
        next()
    }
}

/**
 * Updates the existing gear to either remove the rental relationship or add a rental relationship depending on the 
 * request method.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
async function updateGear (req, res, next) {
    const {existGear, existRental} = req.body
    
    // update existing Gear depending on if you're deleting or adding a relationship
    if (req.method === "PUT") {
        existGear.available = false
        existGear.rental = existRental.id
    } else {
        existGear.available = true
        existGear.rental = null
    }

    // update item
    try {
        await model.updateItem(existGear, 'gear')
        next()
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
}

/**
 * Updates the existing rental to either remove the gear from the gear array or add it to the gear array depending on the
 * request method.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
async function updateRental (req, res, next) {
    const {existGear, existRental} = req.body

    // update the rental depending on if you're deleting or adding a relationship
    if (req.method === "PUT") {
        let gearIdentifier = {}
        gearIdentifier.id = existGear.id
        gearIdentifier["item description"] = existGear["item description"]
        existRental.gear.push(gearIdentifier)
    } else {
        let newRentalGear = []
        existRental.gear.forEach(piece => {
            if (piece.id !== existGear.id){
                newRentalGear.push(piece)
            }
        })
        existRental.gear = newRentalGear
    }

    // update item
    try {
        await model.updateItem(existRental, 'rentals')
        next()
    } catch (err) {
        console.error(err)
        res.status(500).send()
    }
}

function verifyGearAndRentalRelated (req, res, next) {
    const {existGear, existRental} = req.body

    if (existGear.rental !== existRental.id) {
        res.status(400).send(errorMessages[400].gearRentalNotRelated)
    } else {
        next()
    }
}

function verifyGearIsAvailable (req, res, next) {
    const {existGear, existRental} = req.body

    if (existGear.available) {
        next()
    } else {
        res.status(400).send(errorMessages[400].gearNotFree)
    }
}

/**
 * Middleware to use when a method is not allowed. Sends a 405 status code with the allowed methods set in the header.
 * @param {*} req 
 * @param {*} res 
 */
 function methodNotAllowed (req, res) {
    res.status(405).setHeader('Allow', ["PUT", "DELETE"]).end()
}


/* -------------------------- RELATIONSHIP ROUTES FOR GEAR AND RENTALS -------------------------- */

router.use('/:rental_id/gear/:gear_id', verifyJWT, verifyGearExists, verifyRentalExists, verifyUserOwnsRental, (req, res, next) => {
    next()
})

router.get('/:rental_id/gear/:gear_id', methodNotAllowed)
router.post('/:rental_id/gear/:gear_id', methodNotAllowed)
router.patch('/:rental_id/gear/:gear_id', methodNotAllowed)

/**
 * Ties a piece of gear to a rental
 */
router.put('/:rental_id/gear/:gear_id', verifyGearIsAvailable, updateGear, updateRental, (req, res) => {
    res.status(204).send()
})

/**
 * Removes a piece of gear from a rental WITHOUT deleting the gear or rental
 */
router.delete('/:rental_id/gear/:gear_id', verifyGearAndRentalRelated, updateGear, updateRental, (req, res) => {
    res.status(204).send()
})

module.exports = router