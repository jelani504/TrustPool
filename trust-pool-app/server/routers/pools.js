const pools = require('express').Router();
let stripe = require('stripe');
const {
  createPool,
  findPoolById,
  findPoolByName,
  findAllPools,
  findPublicPools,
  createPoolMember,
  createJoinRequest,
  findUserByGoogle,
  findAllPoolMembers,
  updatePool,
  findPoolMember,
  createContribution
} = require('./../../database/helpers');
const { STRIPEKEY } = require('../config');


stripe = stripe(STRIPEKEY);

pools.get('/', (req, res) => {
  findPublicPools()
    .then(poolsArr => res.status(200).json(poolsArr))
    .catch((err) => {
      res.status(500).send(err);
    });
  // this will respond with all public pools
});

pools.get('/:poolid/ismember', (req, res) => {
  const { user, params } = req;
  const { poolid } = params;
  const { googleID } = user;
  findUserByGoogle(googleID)
    .then((resUser) => {
      const { id } = resUser;
      findPoolMember(id, poolid)
        .then((member) => {
          if (member) {
            res.status(200).json({ member });
          } else {
            res.status(200).json({ member: false });
          }
        })
        .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
  // find poolmembers where poolid and userid
});

pools.get('/:poolId', (req, res) => {
  const { poolId } = req.params;
  findPoolById(poolId)
    .then((pool) => {
      if (pool) {
        res.status(200).send(pool);
      } else {
        res.status(200).send({ error: 'Pool Not Found' });
      }
    })
    .catch((err) => {
      res.status(500).send(err);
    });
  // this will respond with the pool requested
});

pools.post('/create', (req, res) => {
  const { user, body } = req;
  const {
    name,
    imgUrl,
    desc,
    voteConfig,
    publicOpt
  } = body.pool;
  const { googleID } = user;
  findUserByGoogle(googleID)
    .then((resUser) => {
      const { id } = resUser;
      return findPoolByName(name)
        .then((pool) => {
          if (pool) {
            return res.status(200).send({ error: 'POOL ALREADY EXISTS' });
          }
          return createPool(name, imgUrl, desc, voteConfig, id, publicOpt)
            .then((result) => {
              res.status(200).send(result);
            });
        });
    })
    .catch(() => {});
});

pools.post('/expense', (req, res) => {
  const {
    poolId,
    creatorId,
    title,
    desc,
    amount,
    expiration,
    method
  } = req.body;
  res.status(200).send(`recieved request to create new expense request in pool ${poolId}`);
});

pools.post('/vote', (req, res) => {
  const { poolId, memberId, vote } = req.body;
  res.status(200).send(`recieved request for member ${memberId} to vote ${vote} in pool ${poolId}`);
});

pools.post('/contribute', (req, res) => {
  const { body, user } = req;
  const {
    poolId,
    amount,
    stripeToken
  } = body;
  const token = stripeToken;
  const { googleID } = user;

  // Pay with stripe,
  // if stripe payment is accepted,
  // create a contributtion entry into db

  // Create a new customer and then a new charge for that customer:
  // stripe.customers.create({
  //   email: 'foo-customer@example.com'
  // })
  //   .then(customer => stripe.customers.createSource(customer.id, {
  //     source: stripeToken
  //   }))
  //   .then(source => stripe.charges.create({
  //     amount: 1600,
  //     currency: 'usd',
  //     customer: source.customer
  //   }))
  //   .then((charge) => {
  //     console.log(charge, 'CHARGE');
  //     // New charge created on a new customer
  //   })
  //   .catch((err) => {
  //     console.log(err, 'ERROR');
  //     // Deal with an error
  //   });

  stripe.charges.create({
    amount,
    currency: 'usd',
    source: 'tok_visa' || token
  }, (err, charge) => {
    if (err && err.type === 'StripeCardError') {
      res.status(200).json({ error: 'CARD DECLINED' });
    }
    if (err) {
      res.status(200).json({ err });
    } else {
      findUserByGoogle(googleID)
        .then((resUser) => {
          const { id } = resUser;
          // create contribution entry
          return createContribution(poolId, id, amount);
        })
        .then((contribution) => {
          res.status(200).json({ success: { charge, contribution } });
        })
        .catch(dberr => res.status(200).json({ dberr }));
    }
  });
});

pools.post('/join', (req, res) => {
  const { body, user } = req;
  const { poolid, socialUser } = body;
  let isMemberCheck = false;
  const { googleID } = user;
  findUserByGoogle(googleID)
    .then((resUser) => {
      const { id } = resUser;
      findAllPoolMembers(poolid)
        .then((poolMembers) => {
          const poolMembersCount = poolMembers.length;
          poolMembers.forEach((member) => {
            const { dataValues } = member;
            const { pool_member_id } = dataValues;
            if (pool_member_id === id) {
              isMemberCheck = true;
            }
          });
          if (isMemberCheck) {
            res.status(409).send(`${socialUser || googleID} is already a member of pool ${poolid}`);
          } else {
            // create join pool request
            createJoinRequest(id, poolid)
              .then(() => res.status(200).json({ message: 'SUCCESSFULLY CREATED JOIN POOL REQUEST' }))
              .catch(err => console.log(err));
            // createPoolMember(poolid, id)
            //   .then(() => {
            //     updatePool(poolid, 'members_count', poolMembersCount + 1);
            //     res.status(200).json({ message: `${socialUser || googleID} SUCCESSFULLY ADDED MEMBER TO POOl ${poolid}` });
            //   })
            //   .catch(err => console.log(err));
          }
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
});

pools.post('/chat', (req, res) => {
  const { poolId, userId, message } = req.body;
  res.status(200).send(`recieved request for ${userId} to chat in pool ${poolId}`);
});

module.exports = pools;
