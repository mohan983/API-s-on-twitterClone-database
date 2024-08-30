const express = require('express')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')
const {open} = require('sqlite')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

//API 1
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(request.body.password, 10)
      const createUserQuery = `
      INSERT INTO 
        user (name,username, password, gender) 
      VALUES 
        (
          '${name}',
          '${username}', 
          '${hashedPassword}', 
          '${gender}'
        )`
      const dbResponse = await db.run(createUserQuery)
      const newUserId = dbResponse.lastID
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//API 2
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'my access token')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//Authentication middleware
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401).send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'my access token', async (Error, payload) => {
      if (Error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//userMiddleware function
const getUserId = async (request, response, next) => {
  const {username} = request
  const getUserQuery = `
    select * from user where username='${username}'
  `
  const user = await db.get(getUserQuery)
  request.user_id = user.user_id
  next()
}

//userFollowingMiddleware function
const isUserFollowing = async (request, response, next) => {
  const {tweetId} = request.params
  const {user_id} = request
  const followingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id};`
  const userFollowingData = await db.all(followingQuery)

  const tweetUserIdQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId}`
  const tweetData = await db.get(tweetUserIdQuery)
  const tweetUserID = tweetData['user_id']

  let isTweetUSerIDInFollowingIds = false
  userFollowingData.forEach(each => {
    if (each['following_user_id'] === tweetUserID) {
      isTweetUSerIDInFollowingIds = true
    }
  })

  if (isTweetUSerIDInFollowingIds) {
    next()
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
}

//API 3
app.get(
  '/user/tweets/feed/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    const getUserTweetDetails = `
    SELECT username, tweet, date_time As dateTime
    FROM follower INNER JOIN tweet
    ON follower.following_user_id = tweet.user_id
    NATURAL JOIN user
    WHERE follower.follower_user_id = ${user_id}
    ORDER BY dateTime DESC
    LIMIT 4
    `
    const tweet = await db.all(getUserTweetDetails)
    response.send(tweet)
  },
)

//API_4
app.get(
  '/user/following/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    const getUserFollowingDetails = `
    SELECT
      name
    FROM
      user INNER JOIN follower
      ON user.user_id=follower.following_user_id 
      where follower.follower_user_id=${user_id}
    `
    const following_user_names = await db.all(getUserFollowingDetails)
    response.send(following_user_names)
  },
)

//API_5
app.get(
  '/user/followers/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    const getUserFollowerDetails = `
    SELECT
      name
    FROM
      user INNER JOIN follower
      ON user.user_id=follower.follower_user_id
    where follower.following_user_id=${user_id}
    `
    const followers_names = await db.all(getUserFollowerDetails)
    response.send(followers_names)
  },
)

//API_6
app.get(
  '/tweets/:tweetId/',
  authenticateToken,
  getUserId,
  isUserFollowing,
  async (request, response) => {
    const {tweetId} = request.params

    const query = `
        SELECT tweet, COUNT() AS replies, date_time AS dateTime 
        FROM tweet INNER JOIN reply
        ON tweet.tweet_id = reply.tweet_id   
        WHERE tweet.tweet_id = ${tweetId};`
    const data = await db.get(query)

    const likesQuery = `
        SELECT COUNT() AS likes
        FROM like WHERE tweet_id  = ${tweetId};`
    const {likes} = await db.get(likesQuery)

    data.likes = likes
    response.send(data)
  },
)

//API_7
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  getUserId,
  isUserFollowing,
  async (request, response) => {
    const {tweetId} = request.params

    const query = `
        SELECT username
        FROM like NATURAL JOIN user
        WHERE tweet_id = ${tweetId};`

    const data = await db.all(query)
    console.log(data)
    const usernamesArray = data.map(each => each.username)
    console.log(usernamesArray)

    response.send({likes: usernamesArray})
  },
)

//API_8
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  getUserId,
  isUserFollowing,
  async (request, response) => {
    const {tweetId} = request.params
    const query = `
        SELECT name, reply
        FROM reply NATURAL JOIN user
        WHERE tweet_id = ${tweetId};`

    const data = await db.all(query)
    // const namesArray = data.map((each) => each.name);

    response.send({replies: data})
  },
)

//API_9
app.get(
  '/user/tweets/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    const query = `
    SELECT tweet, COUNT() AS likes, date_time As dateTime
    FROM tweet INNER JOIN like
    ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${user_id}
    GROUP BY tweet.tweet_id;`
    let likesData = await db.all(query)

    const repliesQuery = `
    SELECT tweet, COUNT() AS replies
    FROM tweet INNER JOIN reply
    ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.user_id = ${user_id}
    GROUP BY tweet.tweet_id;`

    const repliesData = await db.all(repliesQuery)

    likesData.forEach(each => {
      for (let data of repliesData) {
        if (each.tweet === data.tweet) {
          each.replies = data.replies
          break
        }
      }
    })
    response.send(likesData)
  },
)

//API_10
app.post(
  '/user/tweets/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    const tweetDetails = request.body
    const {tweet} = tweetDetails
    const addTweetDetails = `
    INSERT INTO
      tweet(tweet,user_id)
    VALUES
      (
        '${tweet}',
        ${user_id}
      );`

    const dbResponse = await db.run(addTweetDetails)
    const tweetId = dbResponse.lastID
    response.send('Created a Tweet')
  },
)

//API_11
app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  getUserId,
  async (request, response) => {
    const {user_id} = request
    console.log(user_id)
    const {tweetId} = request.params
    const userTweetsQuery = `
    SELECT tweet_id, user_id 
    FROM tweet
    WHERE user_id = ${user_id};`
    const userTweetsData = await db.all(userTweetsQuery)

    let isTweetUsers = false
    userTweetsData.forEach(each => {
      if (each['tweet_id'] == tweetId) {
        isTweetUsers = true
      }
    })

    if (isTweetUsers) {
      const query = `
        DELETE FROM tweet
        WHERE tweet_id = ${tweetId};`
      await db.run(query)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

module.exports = app
