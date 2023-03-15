const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//authentication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API_1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}',
          '${hashedPassword}', 
          '${name}',
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API_2

app.post("/login/", async (request, response) => {
  const loginDetails = request.body;
  const { username, password } = loginDetails;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API_3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUserTweetDetails = `
    SELECT
      username,tweet,date_time AS dateTime
    FROM
      user NATURAL JOIN tweet
    `;
  const tweet = await db.all(getUserTweetDetails);
  response.send(tweet);
});

//API_4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getUserFollowingDetails = `
    SELECT
      name
    FROM
      user INNER JOIN follower
      ON user.user_id=follower.following_user_id 
    `;
  const name = await db.all(getUserFollowingDetails);
  response.send(name);
});

//API_5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getUserFollowerDetails = `
    SELECT
      name
    FROM
      user INNER JOIN follower
      ON user.user_id=follower.follower_user_id 
    `;
  const name = await db.all(getUserFollowerDetails);
  response.send(name);
});

//API_6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const tweetsQuery = `
   SELECT
   *
   FROM tweet
   WHERE tweet_id=${tweetId}
   `;

  const tweetResult = await db.get(tweetsQuery);
  const userFollowersQuery = `
    SELECT
    *
  FROM follower INNER JOIN user on user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${id};`;

  const userFollowers = await db.all(userFollowersQuery);

  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
  } else {
    request.status(401);
    request.send("Invalid Request");
  }
});

//API_7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const tweetsQuery = `
   SELECT
   *
   FROM tweet
   WHERE tweet_id=${tweetId}
   `;

    const tweetResult = await db.get(tweetsQuery);
    const userFollowersQuery = `
    SELECT
    *
  FROM follower INNER JOIN user on user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${id}`;

    const userFollowers = await db.all(userFollowersQuery);

    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetResult.user_id
      )
    ) {
    } else {
      request.status(401);
      request.send("Invalid Request");
    }
  }
);

//API_8

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const tweetsQuery = `
   SELECT
   *
   FROM tweet
   WHERE tweet_id=${tweetId}
   `;

  const tweetResult = await db.get(tweetsQuery);
  const userFollowersQuery = `
    SELECT
    *
  FROM follower INNER JOIN user on user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${id};`;

  const userFollowers = await db.all(userFollowersQuery);

  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
  } else {
    request.status(401);
    request.send("Invalid Request");
  }
});

//API_9

//API_10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const tweetDetails = request.body;
  const { tweet } = tweetDetails;
  const addTweetDetails = `
    INSERT INTO
      tweet(tweet)
    VALUES
      (
        '${tweet}'
      );`;

  const dbResponse = await db.run(addTweetDetails);
  const tweetId = dbResponse.lastID;
  response.send("Created a Tweet");
});

//API_11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetDetails = `
    DELETE FROM
      tweet
    WHERE
      tweet_id='${tweetId}';
      `;
    const dbResponse = await db.run(deleteTweetDetails);
    response.send("Tweet Removed");
  }
);

module.exports = app;
