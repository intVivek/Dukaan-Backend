const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const validator = require('validator');
const bcrypt = require('bcrypt');
const cors = require('cors');
var pluralize = require('pluralize')
const initializePassport = require('./passport-config');
app = express();
require('dotenv').config()

app.use(express.static(path.join(__dirname, 'client/build')));
app.use(express.urlencoded({ extended: false }))
app.use(express.json());
app.use(cors({credentials: true, origin: 'https://dukaan-app.netlify.app'}));
var MySQLStore = require('express-mysql-session')(session);


const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	database: process.env.DB_NAME,
	password: process.env.DB_PASS,
	port: process.env.DB_PORT,
	multipleStatements: true
});


db.connect(function (err) {
	if (err) throw err;
	console.log("Database Connected");
});

const getUserByEmail = (email, done) => {
	db.query('select id,name,email,password,number from user where email = ?', email, (error, results) => {
		done(results[0]);
	});
}

const getUserByid = (id, done) => {
	db.query('select id,name,email,password,number from user where id = ?', id, (error, results) => {
		done(results[0]);
	});
}

var sessionStore = new MySQLStore({
	checkExpirationInterval: 900000,
	expiration: 86400000,
	createDatabaseTable: true,
	schema: {
			tableName: process.env.sessions_table,
			columnNames: {
					session_id: 'session_id',
					expires: 'expires',
					data: 'data'
			}
	}
}, db);


app.use(session({
	secret: process.env.sessions_key,
	resave: false,
	store: sessionStore,
	saveUninitialized: true,
	cookie: {
		maxAge : 86400000
	}
}));

app.use(passport.initialize());
app.use(passport.session());

initializePassport(getUserByEmail, getUserByid);

function isNumeric(value) {
	return /^\d+$/.test(value);
}

app.post('/product',(req,res)=>{

	var {search,page,sort,minPrice,maxPrice,isAssured,filterRating,filterBrand}=req.body;
if(search){
	if(pluralize.isSingular(search)){
		search='MATCH(product_name,product_category_tree,brand,product_specifications ) AGAINST("'+search+' '+pluralize.plural(search)+'"  IN NATURAL LANGUAGE MODE) ';
	}
	else{
		search='MATCH(product_name,product_category_tree,brand,product_specifications ) AGAINST("'+search+' '+pluralize.singular(search)+'"  IN NATURAL LANGUAGE MODE) ';
	}
}
else{
	search='';
}
	isNumeric(page)?page=' limit '+24*(parseInt(page)-1)+',24':page=' limit  0,24';

	sort=='product_rating DESC'||sort=='discounted_price ASC'||sort=='discounted_price DESC'?sort=' order by '+sort:sort='';
	
	isAssured==1?isAssured=' and assured=1':isAssured='';

	isNumeric(filterRating)?filterRating=' and product_rating>='+filterRating:filterRating='';

	if(isNumeric(minPrice)){
		minPrice=' and discounted_price >='+minPrice;
	}
	else{
		minPrice=' ';
	}
	if(isNumeric(maxPrice)){
		maxPrice=' and discounted_price <='+maxPrice;
	}
	else{
		maxPrice=' ';
	}

	var brand='';
	if(filterBrand.length>0){
		filterBrand.forEach((key)=>{
			brand+=",'"+key+"'";
		});
		brand=brand.replace(",","");
		brand =" and brand IN ("+brand+")";
	}

	var names =" products.id,product_name,retail_price,discounted_price,assured,product_rating,product_specifications,url ";

	var q1='select'+names+'from products inner join images on products.id=images.product_id where top=TRUE and '+search+minPrice+maxPrice+isAssured+filterRating+brand+sort+page+'; ';

	var q2='select count(*) as count from products where '+search+minPrice+maxPrice+isAssured+filterRating+brand+'; ';

	var q3='select distinct brand as brand from products where '+search+'; ';
console.log(q);
	var q=q1+q2+q3;
	console.log(q1);
	db.query(q,(err, result) => {
		res.json(result);
	});
});

app.post('/openProduct',(req, res) => {
	var {product_id}=req.body;
	db.query('select products.id,product_name,retail_price,discounted_price,assured,product_rating,description,product_specifications from products where id = ?',product_id,(err, result) => {
		db.query('select url from images where product_id = ?',product_id,(err, results) => {
			console.log([result[0],results])
			res.json([result[0],results]);
		});
	});
});

app.post('/home',(req, res) => {
	var {pageNum}=req.body;
	console.log('sdasd',req.isAuthenticated());
	db.query('select product_name,retail_price,discounted_price,product_rating,assured,products.id,url from products inner join images on products.id=images.product_id where top=TRUE order by RAND() limit 40',(err, result) => {
		res.json(result);
	});
});

app.post('/addToCart',(req, res) => {
	var {user_id,product_id,quantity}=req.body;
	db.query('INSERT INTO cart(user_id,product_id,quantity) VALUES (?,?,?);',[user_id,product_id,quantity],(err, result)=>{
		res.status(200).json({
			status: 0,
		});
	});
});

app.post('/alterQty',(req, res) => {
	var {user_id,product_id,cart_id,quantity}=req.body;
	if(quantity>0){
		console.log('alterQTY',req.body);
		db.query('update cart set quantity = ? WHERE user_id = ? and product_id = ? and id = ?;',[quantity,user_id,product_id,cart_id],(err, result)=>{
			res.status(200).json({
				status: 0,
			});
		});
	}

});

app.post('/buyNow',(req, res) => {
	var {user_id,product_id,price,quantity}=req.body;
	var q='insert into orders (user_id,product_id,price,quantity) values (?,?,?,?)'
	db.query(q,[user_id,product_id,price,quantity],(err, result) => {
		console.log(q,req.body);
		res.status(200).json({
			status: 0,
		});
	});
});

app.post('/deleteFromCart',(req, res) => {
	var {user_id,product_id,cart_id}=req.body;
	console.log('remove',req.body);
	db.query('delete from cart WHERE user_id = ? and product_id = ? and id = ?;',[user_id,product_id,cart_id],(err, result) => {
		res.status(200).json({
			status: 0,
		});
	});
});

app.post('/openCart',(req, res) => {
	var {user_id}=req.body;
	db.query('select cart.id as cart_id,product_name,retail_price,discounted_price,products.id as product_id,quantity,url from products inner join cart on products.id=cart.product_id inner join images on products.id=images.product_id where top = TRUE and cart.user_id=? order by created_at desc',[user_id],(err, result) => {
		console.log('cart',result)
		res.status(200).json(result);
	});
});

app.post('/openOrders',(req, res) => {
	var {user_id}=req.body;
	console.log(req.body);
	db.query('select orders.id as orders_id,product_name,price,products.id,quantity,created_at as date,url from products inner join orders on products.id=orders.product_id inner join images on products.id=images.product_id where top = TRUE and orders.user_id=? order by created_at desc',user_id,(err, result) => {
		res.status(200).json(result);
	});
});

app.post('/cartOrderAll',(req, res) => {
	var {user_id}=req.body;
	var q='insert into orders (user_id,product_id,quantity,price) select user_id,products.id,quantity,discounted_price from products inner join cart on products.id=cart.product_id where cart.user_id=? order by created_at desc';
	db.query(q,user_id,(err, result) => {
		db.query('delete from cart where user_id = ?',user_id,(err, results) => {
			res.status(200).json({
				status: 0,
			});
		});
	});
});

app.post('/isLogin',(req, res) => {
	console.log('isLogin',req.isAuthenticated())
		if(req.isAuthenticated()){
			var q='select id,name,email,number,created_at from user where id='+req?.session?.passport.user;
			console.log(q);
			db.query(q,(err, results) => {
				console.log(results);
				res.json(results);
			});
			
		}
});

app.post('/login', (req, res, next) => {
	passport.authenticate('local', (error, user, authInfo) => {
		if (!user) return res.status(403).json([authInfo,null]);

		req.logIn(user, (err) => {
			res.status(200).json([authInfo,user]);
		});
	})(req, res, next)
});

app.post('/register', (req, res) => {
	const { name, email, number, password } = req.body;
	if(name!==''){
		if (validator.isEmail(email)) {
			if (validator.isMobilePhone(number)) {
				if (password.length>5) {
					 getUserByEmail(email, async (user) => {
						if (!user) {
							const hashedPass = await bcrypt.hash(password, process.env.hash_key);
							var data = [name, email, hashedPass, number];
							var q = 'insert into user ( name , email , password , number ) values (?)';
							db.query(q, [data], function (error, results, fields) {
								
								if (error) throw error;
								else {
									res.status(200).json({
										status: 0,
										message: "sucessfully Regestered",
										name,
										email,
										number
									});
								}
							});
						}
						else {
							res.status(409).json({
								status: 1,
								message: "User already exists",
							});
						}
					});
				}
				else {
					res.status(404).json({
						status: 2,
						message: "Password should be greater than five digits",
					});
				}
			}
			else {
				res.status(404).json({
					status: 3,
					message: "Enter a valid Phone number",
				});
			}
		}
		else {
			res.status(404).json({
				status: 4,
				message: "Enter a valid Email",
			});
		}
	}
	else {
		res.status(404).json({
			status: 4,
			message: "Username cannot be empty",
		});
	}
});

app.post('/logout', (req, res) => {
  req.logOut();
	res.status(200).json(
		{status:0,
		message:'Succesfully Logged out'
	});
});


app.get('/',(req, res) => {
	res.send('hello');
});

app.listen(process.env.PORT || 5000,()=>{
  console.log("Server hosted at port : 5000");
});