/* This file contains the routes associated with a user loggin in. */
const express = require('express')
const {google} = require('googleapis')
const googleOAuthClient = require('./googleAuthClient')
const model = require('../model')

// define google OAuth values that identify application and scope of authorization
let STATE = undefined
const SCOPES = ['https://www.googleapis.com/auth/userinfo.profile']

/*--------------- Middleware Functions --------------------- */

// define function to generate state value to prevent cross-site attacks during OAuth
function generateState() {
    const stateChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*'
    let stateVal = ''
    for (let i=0; i<30; i++) {
        let randIndex = Math.floor(Math.random() * stateChars.length)
        stateVal = stateVal + stateChars[randIndex]
    }
    return stateVal
}

// define function to check if an OAuth access request was rejected by the user
function checkOAuthReject (req, res, next) {
    if (req.query.error) {
        console.error("Error on Oauth Request: ", req.query.error)
        res.redirect('/login_fail')
    } else {
        next()
    }
}

// define function to verify state value that is passed back by Oauth
async function verifyStateResponse (req, res, next) {
    let result = await model.getFilteredItems('states', 'state', req.query.state)

    if (result[0] === null || result[0] === undefined) {
        console.error("Error: State value passed back from Google OAuth server does not match that generated")
        res.redirect('/login_fail')
    } else {
        await model.deleteItem('states', result[0].id)
        next()
    }
}

// define function to exchange an access token for a JWT on google oAuth and then use this JWT to call people API
async function getUserInfo (req, res, next) {
    const {tokens} = await googleOAuthClient.getToken(req.query.code)
    googleOAuthClient.setCredentials(tokens)
    
    // query people api
    const service = google.people({version: 'v1', auth: googleOAuthClient})
    const response = await service.people.get({
        personFields: 'names',
        resourceName: 'people/me'
    })
    
    // pass the results to the request body
    req.body.names = response.data.names[0]
    req.body.token = tokens.id_token

    next()
}

/*--------------- LOGIN Routes --------------------- */

const router = express.Router()

router.use(express.static('public'))

router.get('/', (req, res) => {
    // display home page that explains what the app is going to do
    res.sendFile('./home.html', {root: './public'})
})

router.get('/login', async (req, res) => {
     // generate and save state value to use during OAuth process
     STATE = generateState()
     await model.postItem({state: STATE}, 'states')

    // generate google OAuth2.0 request
    const authUrl = googleOAuthClient.generateAuthUrl({
        scope: SCOPES,
        state: STATE
    })
    
    // redirect to google's oauth server
    res.redirect(authUrl)
})

router.get('/oauth', checkOAuthReject, verifyStateResponse, getUserInfo, (req, res) => {
    // req body now has user info and JWT, so redirect to login success page with that info in the URL
    res.redirect(`/login_success?first=${req.body.names.givenName}&last=${req.body.names.familyName}&token=${req.body.token}&id=${req.body.names.metadata.source.id}`)
})

router.get('/login_success', (req, res) => {
    res.sendFile('./login_success.html', {root: './public'})
})

router.get('/login_fail', (req, res) => {
    res.sendFile('./login_fail.html', {root: './public'})
})


module.exports = router
