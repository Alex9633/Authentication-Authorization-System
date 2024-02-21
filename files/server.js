const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// kreira express aplikacija
const app = express();
app.listen(3000);    // da moze da prima baranja (localhost, porta 3000)
app.use(express.urlencoded({ extended: true }))    // za parsiranje na baranjata
app.use(express.static('public'));   // pristap do html vo 'public' folderot
app.set('view engine', 'ejs');

// go cita json failot so korisnickite informacii
const dataPath = path.join(__dirname, 'databasesim.json');
let userData = [];
let validationCodes = {};

const roles = { owner: 'owner', admin: 'admin', user: 'user', };

try {
  const data = fs.readFileSync(dataPath, 'utf-8');
  userData = JSON.parse(data);
}
catch (err) { console.error(err); }

app.use(session({
  secret: 'mcxedonc43ffdcmef9paa',   // taen kluc
  resave: true,
  saveUninitialized: true
}));

app.get('/login', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'login.html'));});
app.get('/register', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'register.html'));});
app.get('/validate', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'validate.html'));});
app.get('/main', (req, res) => {res.render('main', { user: req.session.user });});
app.get('/admin', (req, res) => {
  // dozvoluva pristap samo na users so admin ili owner uloga 
  if (req.session.user && (req.session.user.role === roles.admin || req.session.user.role === roles.owner))
    res.render('adminPage', { userData: userData, userRole: req.session.user.role });
  else res.redirect('/main');
});

function delay(req, res, next) {
  setTimeout(next, 3000);
}

// funkcionalnost na register.html
app.post('/register', delay, (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    res.send("Passwords do not match. Please make sure both passwords are the same.");
    return;
  }

  // dali username ili email veke postojat
  const userExists = userData.some((user) => user.username === username);
  const emailExists = userData.some((user) => user.email === email);
  
  if (userExists) res.send('Username already exists. Please choose another.');
  else if (emailExists) res.send('Email already exists. Please choose another.');
  else {
	bcrypt.genSalt(10, (err, salt) => {      // generira salt
      if (err) throw err;
      bcrypt.hash(password, salt, (err, hash) => {     // hashira lozinkata
        if (err) throw err;
	    
		const validationCode = Math.floor(100000000000 + Math.random() * 900000000000);   // generira random 12 cifren kod
        validationCodes[email] = validationCode;
        sendEmail(email, validationCode);
		
		// zacuvuva informaciite za noviot profil vo userData
		if(username === 'alex') userData.push({ username, email, role: 'owner', password: hash, salt });
	    else userData.push({ username, email, role: 'user', password: hash, salt }); 		// mu dava uloga na noviot korisnik
		
        res.redirect(`/validate?email=${encodeURIComponent(email)}`);	      // go prenesuva korisnikot na validate.html
      });
    });
  }
});

// validacija na email
app.post('/validate', delay, (req, res) => {
  const { userEmail, validationCode } = req.body;
  
  if (validationCodes[userEmail] && validationCodes[userEmail] == validationCode) {
    const userIndex = userData.findIndex((user) => user.email === userEmail);
	const user = userData.find((user) => user.email === userEmail);
	
    if (userIndex !== -1) {
      fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2), 'utf-8');   //ako e uspesna validacijata, gi zapisuva informaciite vo databazata
	  
	  req.session.user = { username: user.username, role: user.role };
      res.render('main', { user: req.session.user });    //ako e uspesna, zapisuva informaciite vo databazata i prenesuva korisnikot na main.html
    }
	else res.send('Validation failed. Please try again.');
  } 
  else res.send('Validation failed. Please try again.');
});

// simulacija na prakanje verifikaciski kod
function sendEmail(email, validationCode) {
  console.log(`Sending validation email to ${email} with code: ${validationCode}`);
}

// funkcionalnost na login.html
app.post('/login', delay, (req, res) => {
  const { username, password } = req.body;

  //dali vnesenite username i password odgovaraat na postoecki profil
  const user = userData.find((u) => u.username === username);
  if (user) {
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
		  req.session.user = { username, role: user.role };
		  res.render('main', { user: req.session.user });    // ako da, go prenesuva korisnikot na main.html
	  }
      else res.send('Incorrect username or password. Please try again.');
	});
  } 
  else res.send('Incorrect username or password. Please try again.');
});

// izbrisi user
app.post('/delete-user', (req, res) => {
  const { deleteUser } = req.body;
  const userIndex = userData.findIndex(user => user.username === deleteUser);

  if (userIndex !== -1) {
    userData.splice(userIndex, 1);
    fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2), 'utf-8');
    res.redirect('/admin');
  } 
  else res.send('User not found.');
});

// smeni uloga na user
app.post('/change-role', (req, res) => {
  const { changeToAdmin, changeToUser } = req.body;
  const userToChange = changeToAdmin || changeToUser;

  const userIndex = userData.findIndex(user => user.username === userToChange);

  if (userIndex !== -1) {
    if (changeToAdmin) userData[userIndex].role = 'admin';
    else if (changeToUser) userData[userIndex].role = 'user';

    fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2), 'utf-8');
    res.redirect('/admin');
  } 
  else res.send('User not found.');
});