/* This file contains the routes associated with a user loggin in. */
const express = require('express')
const model = require('../model')

// define google OAuth values that identify application
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
let STATE = undefined

// define function to generate state value to prevent cross-site attacks during OAuth
function generateState() {
    let stateVal = ''
    let stateChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*'
    for (let i=0; i<30; i++) {
        let randIndex = Math.floor(Math.random() * stateChars.length)
        stateVal = stateVal + stateChars[randIndex]
    }
    return stateVal
}

const router = express.Router()

router.get('/', () => {
    // generate and save state value to use during OAuth process
    STATE = generateState()
    model.postItem({state: STATE}, 'states')
    

    // 
    console.log(process.env.CLIENT_ID)
})

module.exports = router
