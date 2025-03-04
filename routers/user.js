const express = require('express')
const multer = require('multer')
const sharp = require('sharp')
const mailer = require('../utils/mailer')
const os = require('os')
const router = new express.Router()
const path = require('path')

const auth = require('../middleware/auth')
const User = require('../models/user')

router.get('/test', (req, res) => {
    res.render('test')
})

//create a user
router.post('/users', async(req, res) => {
    try {
        const user = new User(req.body)
        await user.save()

        mailer({
            from: process.env.NODEMAILER_USERNAME,
            to: user.email,
            subject: 'Your account was successfully created',
            text: 'Start your plan with your new task manager application'
        }).catch(e => {
            console.log(e.response)
        })

        const token = await user.generateAuthToken()

        res.status(201).send({
            token,
            owner: user._id
        })

    } catch (e) {
        res.status(400).send(e)
    }
});
//login route
router.post('/users/login', async(req, res) => {
    try {
        const user = await User.findByCredentials(req.body)

        const currentdate = new Date();
        const datetime = currentdate.getDate() + "/" +
            (currentdate.getMonth() + 1) + "/" +
            currentdate.getFullYear() + " @ " +
            currentdate.getHours() + ":" +
            currentdate.getMinutes()

        mailer({
            from: process.env.NODEMAILER_USERNAME,
            to: user.email,
            subject: 'New login',
            text: `Your account was logged in at ${datetime} using ${os.platform()}`
        }).catch(e => {
            console.log('something wrong with mailer')
        })

        const token = await user.generateAuthToken()

        res.status(200).send({
            token,
            owner: user._id
        })

    } catch (e) {
        res.status(400).send(e.toString())
    }
});
//logout user
router.post('/users/logout', auth, async(req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter(token => {
            return token.token !== req.token
        })
        await req.user.save()
        res.status(200).send({
            message: 'Đã đăng xuất'
        })
    } catch (e) {
        res.status(500).send(e.message)
    }
});
//logout all sessions
router.post('/users/logoutall', auth, async(req, res) => {
    try {
        req.user.tokens = []
        await req.user.save()
        res.send(req.user)
    } catch (e) {
        res.status(500).send(e.message)
    }
});
//fetch all users
router.get('/users/me', auth, async(req, res) => {
    res.status(200).send(req.user)
});
//update user
router.patch('/users/me', auth, async(req, res) => {
    const newValue = req.body
    const keys = Object.keys(newValue)
    const check = keys.every((key) => {
        return ["name", "email", "password"].includes(key)
    })
    if (check) {
        try {
            keys.forEach(key => {
                req.user[key] = newValue[key]
            })
            const updatedUser = await req.user.save()
            res.status(200).send(updatedUser)
        } catch (e) {
            res.status(500).send(e)
        }
    } else {
        res.status(400).send("accepted keys: ['name', 'email', 'password']")
    }
});
//delete user
router.delete('/users/me', auth, async(req, res) => {

    try {
        await req.user.remove()

        mailer({
            from: process.env.NODEMAILER_USERNAME,
            to: req.user.email,
            subject: 'Your account was successfully deleted',
            text: 'Thank you for using our application, hope you back soon!'
        }).catch(e => {
            console.log('something wrong with mailer')
        })

        res.send(`deleted user ${req.user.email}`)

    } catch (e) {
        res.status(500).send(e)
    }
});
//upload user profile picture
const upload = multer({
    limits: {
        fileSize: 5000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname) {
            return cb(new Error('Please select an image'))
        }
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/))
            return cb(new Error('File must be an image'))
        cb(undefined, true)
    }
});
//upload user's avatar
router.post('/users/me/avatar', auth, async(req, res) => {
    try {
        req.user.avatarObj = {
            data: req.body.file.buffer,
            contentType: 'image/' + req.body.originalname.match(/\.(jpg|jpeg|png|gif)$/)[1]
        };
        await req.user.save();
        res.send({ message: "User avatar uploaded" });
    } catch (err) {
        res.status(500).send(err);
    }
}, (err, req, res, next) => {
    res.status(400).send({ "error": err.message });
})

//delete user profile avatar
router.delete('/users/me/avatar', auth, async(req, res) => {
    try {
        req.user.avatarObj = undefined
        await req.user.save()
        res.send({ message: "Deleted user's avatar" })
    } catch (error) {
        res.status(500).send(error.message)
    }
});
//get user avatar
router.get('/users/:id/avatar', async(req, res) => {
    try {

        const user = await User.findById(req.params.id)

        if (user && !user.avatarObj.$isEmpty()) {
            res.set('Content-Type', user.avatarObj.contentType)
            res.send(user.avatarObj)
        } else {
            res.send({ message: 'no avatar' })
        }

    } catch (err) {
        res.send({ message: err.message })
    }
});

router.post('/check-old-password', auth, async(req, res) => {
    const userObject = {
        email: req.user.email,
        password: req.body.currentPwd
    }
    try {
        const user = await User.findByCredentials(userObject)
        if (user) {
            res.status(200).send({
                isMatch: true,
                user
            })
        }
    } catch (error) {
        res.status(400).send({
            message: error.message
        })
    }

})

module.exports = router