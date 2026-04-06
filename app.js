const express = require("express");
const path = require("path");
const { check, validationResult } = require("express-validator");
const mongoose = require("mongoose");

var session = require("express-session");
const { name } = require("ejs");

const Order = mongoose.model("Order", {
  name: String,
  email: String,
  phone: String,
  postcode: String,
  lunch: String,
  ticket: Number,
  campus: String,
  sub: Number,
  tax: Number,
  total: Number,
});

const Admin = mongoose.model("Admin", {
  username: String,
  password: String,
});

const app = express();

app.use(
  session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true,
  }),
);

mongoose.connect(
  "mongodb+srv://myUser:poseidon@cluster0.yozwd4a.mongodb.net/CollegeOrder",
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("form.ejs");
});

app.post(
  "/processForm",
  [
    check("name", "Name is Empty").notEmpty(),
    check("email", "Not a valid Email").isEmail(),
    check("tickets", "Ticket Not Selected")
      .notEmpty()
      .custom((value) => {
        if (isNaN(value)) {
          throw Error("This is not a number");
        } else if (value <= 0) {
          throw Error("This number is less than 0");
        } else {
          return true;
        }
      }),
    check("campus", "Campus Not Selected").notEmpty(),
    check("lunch", "Select Yes/No for Lunch").notEmpty(),
    check("postcode", "Invalid Post Code Format").matches(
      /^[a-zA-Z]\d[a-zA-Z]\s\d[a-zA-Z]\d$/,
    ),
    check("phone", "Invalid phone Number").matches(
      /^\d{3}(\s|-)\d{3}(\s|-)\d{4}$/,
    ),
    check("lunch").custom((value, { req }) => {
      if (value == "yes" && req.body.tickets < 3) {
        throw Error("Must buy 3 or more tickets to have a lunch");
      } else {
        return true;
      }
    }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      //No Errors
      var lunch_index = -1,
        cost = 0,
        tax,
        total;

      var name = req.body.name;
      var email = req.body.email;
      //var post = req.body.postcode;
      //var phone = req.body.phone;
      var campus = req.body.campus;
      var tickets = req.body.tickets;
      var lunch = req.body.lunch;
      for (var i = 0; i < lunch.length; i++) {
        if (lunch[i].checked) {
          lunch_index = i; // storing the index that the user selected
          break;
        }
      }
      // Checking if any of the radio buttons was selected
      if (lunch_index > -1) {
        lunch = lunch[lunch_index].value;
      }

      if (tickets > 0) {
        // if tickets were selected
        cost = 100 * tickets;
      }
      if (lunch == "yes") {
        //if taking lunch
        cost += 60; //add 60 to the total cost
      }

      tax = cost * 0.13;
      total = cost + tax;

      var receipt = {
        name: name,
        email: email,
        lunch: lunch,
        campus: campus,
        sub: cost.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      };

      // store to db
      var newOrder = new Order({
        name: receipt.name,
        email: receipt.email,
        phone: req.body.phone,
        postcode: req.body.postcode,
        lunch: receipt.lunch,
        ticket: tickets,
        campus: receipt.campus,
        sub: receipt.sub,
        tax: receipt.tax,
        total: receipt.total,
      });

      newOrder
        .save()
        .then((data) => {
          res.render("form", { recpt: data });
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      //errors there
      res.render("form", { errors: errors.array() });
    }
  },
);

app.get("/orders", (req, res) => {
  if (req.session.loggedIn) {
    Order.find({})
      .then((data) => {
        res.render("orders", {
          datas: data,
          logged: { name: req.session.user, status: req.session.loggedIn },
        });
      })
      .catch((err) => {
        console.log("failed to fetch data");
      });
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post(
  "/login",
  [
    check("uName", "user field empty").notEmpty(),
    check("pword", "password field empty").notEmpty(),
  ],
  (req, res) => {
    var errors = validationResult(req);
    if (errors.isEmpty()) {
      Admin.findOne({ username: req.body.uName })
        .then((data) => {
          if (data == null || data.password != req.body.pword) {
            res.render("login", { loginError: "incorrect" });
          } else {
            req.session.loggedIn = true;
            req.session.user = data.username;
            // res.render("orders", {
            //   logged: { name: req.session.user, status: req.session.loggedIn },
            // });
            console.log("success");
            res.redirect("/orders");
          }
        })
        .catch((err) => {
          console.log("err");
        });
    } else {
      res.render("login", { errors: errors.array() });
    }
  },
);

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
