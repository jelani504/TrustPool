const pools = require('express').Router();
let stripe = require('stripe');
let mailgun = require('mailgun-js');

const {
  createPool,
  findPoolById,
  findPoolByName,
  findAllPools,
  updateExpenseRequest,
  findExpenseRequests,
  findPublicPools,
  createPoolMember,
  createJoinRequest,
  findUserByGoogle,
  findAllPoolMembers,
  updatePool,
  updatePoolMember,
  getJoinRequests,
  findPoolMember,
  createContribution,
  findPoolByMember,
  createExpenseRequest,
  createExpenseRequestLink,
  executeDeliveryMethod
} = require('./../../database/helpers');
const { STRIPEKEY } = require('../config');
const authenticated = require('../passport/authenticated');

const { MAILGUN } = require('../config');

const { apiKey, domain } = MAILGUN;
mailgun = mailgun({ apiKey, domain });
stripe = stripe(STRIPEKEY);

pools.get('/', (req, res) => {
  findPublicPools()
    .then(poolsArr => res.status(200).json(poolsArr))
    .catch((err) => {
      res.status(500).send(err);
    });
  // this will respond with all public pools
});

pools.post('/mailinvite', (req, res) => {
  const { body, user } = req;
  const { googleID } = user;
  const {
    email,
    message,
    poolName,
    poolId,
    url
  } = body;
  findUserByGoogle(googleID)
    .then((resUser) => {
      const { first_name, last_name } = resUser;
      const notification = {
        from: 'Trust Pool App <me@samples.mailgun.org>',
        to: email,
        subject: `Invitaton from ${first_name} ${last_name} to join ${poolName}`,
        text: `

    You have received an invitation to join: ${poolName}
    Message from ${first_name}
    ${message}

    To join this pool click the following link twice (Once to sign up, again to request to join the pool): 
        ${url}/pools/${poolId}/join
    `
      };
      mailgun.messages().send(notification, (err, resBody) => {
        console.log(err, resBody);
        if (err) {
          res.status(200).json({ err });
        } else {
          res.status(200).json({ success: resBody });
        }
      });
    })
    .catch(err => console.log('error'));
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

pools.get('/:poolid/joinrequests', (req, res) => {
  const { params } = req;
  const { poolid } = params;
  getJoinRequests(poolid)
    .then((requests) => {
      res.status(200).json({ requests });
    })
    .catch(err => console.log(err));
  // find poolmembers where poolid and userid
});

pools.post('/joinrequests', (req, res) => {
  const { body } = req;
  const { status, pool_id, user_id } = body.joinRequest;
  if (status === 'accepted') {
    getJoinRequests(pool_id, user_id)
      .then(request => request[0].destroy())
      .then(() => {
        createPoolMember(pool_id, user_id)
          .then(() => {
            updatePool(pool_id, 'members_count', 1);
            res.status(200).json({ message: `${socialUser || googleID} SUCCESSFULLY ADDED MEMBER TO POOl ${pool_id}` });
          })
          .catch(err => console.log(err));
      })
      .catch(err => console.log(err));
  } else {
    res.status(200).json({ success: 'request declined!' });
  }
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

pools.get('/:poolId/expenserequests', (req, res) => {
  const { poolId } = req.params;
  findExpenseRequests(poolId)
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

pools.post('/:requestId/accept', (req, res) => {
  const { params, body } = req;
  const { requestId } = params;
  const {
    votePower,
    memberId,
    poolMembersCount,
    voteConfig
  } = body;
  updateExpenseRequest(requestId, 'vote_up', votePower)
    .then((request) => {
      const { id } = request;
      return updateExpenseRequest(id, 'voter_count', 1);
    })
    .then((requestEntry) => {
      const { voter_count, vote_up, method } = requestEntry;
      const methodLink = method;
      if (vote_up >= voteConfig) {
        // executeDeliveryMethod(methodLink)
        executeDeliveryMethod(methodLink)
          .then(deliveryRes => console.log(deliveryRes))
          .catch(deliveryErr => console.log(deliveryErr));
        res.status(200).json({ success: { concluded: 'VOTE PASSED' } });
      } else if (voter_count === poolMembersCount) {
        res.status(200).json({ success: { concluded: 'VOTE POWER NOT MET' } });
      } else {
        res.status(200).json({ success: 'vote to accept submitted' });
      }
    })
    .then(() => updatePoolMember(null, null, 'has_voted', 't', memberId))
    .catch(err => res.status(200).json({ err }));
});

pools.post('/:requestId/decline', (req, res) => {
  const { params, body } = req;
  const { requestId } = params;
  const {
    votePower,
    memberId,
    poolMembersCount,
    voteConfig
  } = body;

  updateExpenseRequest(requestId, 'vote_down', votePower)
    .then((request) => {
      const { id } = request;
      return updateExpenseRequest(id, 'voter_count', 1);
    })
    .then((requestEntry) => {
      const { voter_count, vote_down } = requestEntry;
      if (vote_down >= voteConfig) {
        // delete request entry
        res.status(200).json({ success: { concluded: 'VOTE NOT PASSED' } });
      } else if (voter_count === poolMembersCount) {
        res.status(200).json({ success: { concluded: 'VOTE POWER NOT MET' } });
      } else {
        res.status(200).json({ success: 'vote to decline submitted' });
      }
    })
    .then(() => updatePoolMember(null, null, 'has_voted', 't', memberId))
    .catch(err => res.status(200).json({ err }));
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
    .catch(() => { });
});

pools.post('/expenselink', (req, res) => {
  const { method } = req.body;
  createExpenseRequestLink(method)
    .then(link => res.status(200).json({ link }))
    .catch(err => res.status(200).json({ err }));
});

pools.post('/expense', (req, res) => {
  const { body, user } = req;
  const {
    pool_id,
    request_title,
    description,
    expense_amount,
    expiration_date,
    method
  } = body;
  const { googleID } = user;

  findUserByGoogle(googleID)
    .then((resUser) => {
      const { id } = resUser;
      return createExpenseRequest(
        pool_id,
        id,
        request_title,
        description,
        expense_amount,
        expiration_date,
        method
      )
        .then(expenseRequestEntry => res.status(200).json({ expenseRequestEntry }));
    })
    .catch(err => res.status(200).json({ err }));
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
    stripeToken,
    memberId
  } = body;
  const token = stripeToken;
  const { googleID } = user;
  const result = {};

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
      result.charge = charge;
      findUserByGoogle(googleID)
        .then((resUser) => {
          const { id } = resUser;
          return createContribution(poolId, id, amount);
        })
        .then((contribRes) => {
          result.contributionEntry = contribRes.contributionEntry;
          result.updatedPool = contribRes.updatedPool;
          res.status(200).json({ result });
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
            // check if existing join pool request
            getJoinRequests(poolid, id)
              .then((requests) => {
                if (requests[0]) {
                  res.status(200).json({ error: 'YOU HAVE ALREADY SUBMITTED A JOIN REQUEST' });
                } else {
                  createJoinRequest(id, poolid)
                    .then(() => res.status(200).json({ message: 'SUCCESSFULLY CREATED JOIN POOL REQUEST' }))
                    .catch(err => console.log(err));
                }
              })
              .catch(err => console.log(err));
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

pools.get('/:poolid/join', authenticated, (req, res) => {
  const { poolid } = req.params;
  const { user } = req;
  let isMemberCheck = false;
  const { googleID } = user;
  findUserByGoogle(googleID)
    .then((resUser) => {
      const { id } = resUser;
      findAllPoolMembers(poolid)
        .then((poolMembers) => {
          poolMembers.forEach((member) => {
            const { dataValues } = member;
            const { pool_member_id } = dataValues;
            if (pool_member_id === id) {
              isMemberCheck = true;
            }
          });
          if (isMemberCheck) {
            res.status(409).send(`${googleID} is already a member of pool ${poolid}`);
          } else {
            // create join pool request
            // check if existing join pool request
            getJoinRequests(poolid, id)
              .then((requests) => {
                if (requests[0]) {
                  res.status(200).json({ error: 'YOU HAVE ALREADY SUBMITTED A JOIN REQUEST' });
                } else {
                  createJoinRequest(id, poolid)
                    .then(() => res.status(200).json({ message: 'SUCCESSFULLY CREATED JOIN POOL REQUEST' }))
                    .catch(err => console.log(err));
                }
              })
              .catch(err => console.log(err));
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

pools.get('/member/poolsOfMember', (req, res) => {
  const { user } = req;
  findPoolByMember(user.googleID)
    .then((data) => {
      res.status(200).send(data);
    }).catch(err => console.log(err));
});

module.exports = pools;
