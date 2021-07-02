const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const validator = require('validator');
const bcrypt = require('bcrypt');
const cors = require('cors');
const initializePassport = require('./passport-config');
app = express();

app.use(express.urlencoded({ extended: false }))
app.use(express.json());
app.use(cors());
const db = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	database: 'ecommerce',
	password: '1+2=Three',
	port: '3306',
	debug: true
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





app.use(passport.initialize());

initializePassport(getUserByEmail, getUserByid);

/**
for(var i = 1; i < 14062; i ++){
	
	db.query('select * from productss where id = ?', i, (error, results) => {
		
		var a =	results[0].product_name.replaceAll('@',','),
			b=	results[0].product_category_tree,
			c=	parseInt(results[0].retail_price.replaceAll('@',',')),
			d=	parseInt(results[0].discounted_price.replaceAll('@',',')),
			e=	results[0].image,
			f=	(Math.random() * 11)>3?'true':'false',
			g=	results[0].description.replaceAll('@',','),
			h=	(Math.round(((Math.random() * 3) + 2)*10)/10)
			j=	results[0].brand.replaceAll('@',','),
			k=	results[0].product_specifications,
			l= Math.floor(Math.random() * 11);
	
		e=e.replaceAll('[','').replaceAll(']','').replaceAll('@ ',',');
		b=b.replaceAll('[','').replaceAll(']','').replaceAll('@ ',',').replaceAll(' >> ',',');
		k = k.replaceAll('@ ',',').replaceAll('{product_specification=>[','').replaceAll('}]}','').replaceAll('{key=>','').replaceAll(',value=>',':').replaceAll('},','|');
		//spec = spec.filter((data) => data.includes(':')&&data.split(':')[0]&&data.split(':')[1]);
		//k=spec.toString();

		var data =[a,b,c,d,e,f,g,h,j,k,l];
		console.log(data);
		var q = 'insert into products ( product_name , product_category_tree , retail_price , discounted_price , image , is_FK_Advantage_product , description , product_rating,brand,product_specifications,popularity ) values (?)';
		db.query(q, [data], function (error, results, fields) {
			if (error) throw error;
		});
	});
}

**/
app.post('/product',(req, res) => {
	var {search,page,sort,filterPrice,isAssured,filterRating,filterBrand}=req.body;
	if(search){
		search=search.charAt(0).toUpperCase() + search.slice(1).toLowerCase();
	}
	if(!filterPrice){
		filterPrice='';
	}
	if(!filterRating){
		filterRating='';
	}
	var brand='';
	if(Object.keys(filterBrand).length>0){
		for (const [key, value] of Object.entries(filterBrand)) {
			brand+=",'"+key+"'";
		}
		brand=brand.replace(",","");
		brand ="and brand IN ("+brand+")";
	}
	var assured=isAssured?" and assured = 'true'":"";
	var names =" id,product_name,retail_price,discounted_price,image,assured,product_rating,product_specifications ";
	var q='select'+names+'from products where product_category_tree like BINARY ? '+filterPrice+assured+filterRating+brand+' ORDER BY '+sort+' limit ?,24';
	db.query(q,['%'+search+'%',24*(page-1)],(error, result1) => {
		db.query('select count(*) as count from products where product_category_tree like BINARY ? '+filterPrice+assured+filterRating+brand,'%'+search+'%',(err, result2) => {
			db.query('select distinct brand as brand from products where product_category_tree like BINARY ? '+filterPrice+assured+filterRating,'%'+search+'%',(err, result3) => {
				res.json([result1,result2[0],result3]);
			});
		});
	});
});



app.post('/openProduct',(req, res) => {
	var {user_id}=req.body;
	db.query('select * from products where id =?',user_id,(err, result) => {
		res.json(result);
	});
});

app.post('/addToCart',(req, res) => {
	var {user_id,product_id}=req.body;
	console.log('add',req.body);
	db.query('insert into cart (user_id,product_id) values (?,?)',[user_id,product_id],(err, result) => {
		res.status(200).json({
			status: 0,
		});
	});
});

app.post('/deleteFromCart',(req, res) => {
	var {cart_id}=req.body;
	console.log('remove',req.body);
	db.query('delete from cart where id=?',cart_id,(err, result) => {
		res.status(200).json({
			status: 0,
		});
	});
});

app.post('/openCart',(req, res) => {
	var {user_id,product_id}=req.body;
	db.query('select count(user_id) as quantity,cart.id as cart_id,image,product_name,retail_price,discounted_price,products.id from products inner join cart on products.id=cart.product_id where cart.user_id=? group by product_id  order by created_at desc',user_id,(err, result) => {
		res.status(200).json(result);
	});
});

app.post('/login', (req, res, next) => {
	passport.authenticate('local', (error, user, authInfo) => {
		if (!user) {
			return res.status(403).json([authInfo,null]);
		}

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
							const hashedPass = await bcrypt.hash(password, 10);
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


app.listen(5000,()=>{
  console.log("Server hosted at port : 5000");
});