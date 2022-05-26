const {google} = require('googleapis')

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

module.exports = googleOAuthClient