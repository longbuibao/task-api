const jwt = require('jsonwebtoken')
const User = require('../models/user')

const auth = async(req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Beare ', '')
        const decoded = jwt.verify(token, 'key')
        console.log(decoded)
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': token })

        if (!user) {
            throw new Error()
        }

        req.user = user
        next()
    } catch (error) {
        res.status(403).send({ error: 'Please Authenticate.' })
    }
}

module.exports = auth