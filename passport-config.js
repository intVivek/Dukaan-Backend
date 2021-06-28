const bcrypt = require('bcrypt');
const passport = require('passport');
const validator = require('validator');
const LocalStrategy = require('passport-local').Strategy

function initialize(getUserByEmail, getUserById) {
	const authenticateUser = (email, password, done) => {
		if(validator.isEmail(email)){
		getUserByEmail (email, async (user) => {
			if (user == null) {
				return done(null, false, { 
					status : 1,
					message: 'No user with that email' })
			}
			try {	
				if (await bcrypt.compare(password, user.password)) {
					return done(null, user,{ 
						status : 0,
						message: 'Login successfull' })
				} else {
					return done(null, false, { 
						status : 2,
						message: 'Password incorrect' })
				}
			} catch (e) {
				return done(e)
			}
		});
	}
	else{
		return done(null, false, { 
			status : 3,
			message: 'Enter a valid Email' })
	}
	}

	passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
	passport.serializeUser((user, done) => done(null, user.id))
	passport.deserializeUser((id, done) => getUserById(id, (res) => done(null, res)))
} 

module.exports = initialize;