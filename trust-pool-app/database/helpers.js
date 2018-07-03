const {
  sequelize,
  Users,
  Pools,
  ExpenseRequestType,
  ExpenseRequest,
  ContributionEntry,
  PoolMembers,
  ChatMessages,
  EbayWishlistEntry,
  Checks,
  JoinRequests
} = require('.');

const models = {
  Users,
  Pools,
  ExpenseRequestType,
  ExpenseRequest,
  ContributionEntry,
  PoolMembers,
  ChatMessages,
  EbayWishlistEntry,
  Checks,
  JoinRequests
};

const findOne = (model, where) => new Promise((resolve, reject) => {
  models[model].find(where)
    .then((item) => {
      resolve(item);
    })
    .catch((err) => {
      reject(err);
    });
});


const findUserById = id => findOne('Users', { where: { id } });

const findUserByGoogle = googleID => findOne('Users', { where: { googleID } });

const findPoolMember = (pool_member_id, pool_id) => findOne('PoolMembers', { where: { pool_member_id, pool_id } });


const findPoolByName = name => findOne('Pools', { where: { name } });

const findPoolById = id => findOne('Pools', { where: { id } });

const findAll = (model, where) => {
  if (where) {
    return new Promise((resolve, reject) => {
      models[model].findAll(where)
        .then((item) => {
          resolve(item);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  return new Promise((resolve, reject) => {
    models[model].findAll()
      .then((item) => {
        resolve(item);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

const findAllPools = () => findAll('Pools');

const findAllUsers = () => findAll('Users');

const findAllPoolMembers = pool_id => findAll('PoolMembers', { where: { pool_id } });

const findOrCreate = (model, where) => new Promise((resolve, reject) => {
  models[model].findOrCreate(where).spread((result, created) => {
    const item = result.get({
      plain: true
    });
    item.isNewRecord = result.isNewRecord;
    if (item) {
      resolve(item);
    } else {
      reject();
    }
  });
});


const findOrCreateUser = (email, first_name, last_name, image_url, password, googleID) => {
  if (email) {
    return findOrCreate('Users', {
      where: { email },
      defaults: {
        first_name,
        last_name,
        image_url,
        password
      }
    });
  }
  if (googleID) {
    return findOrCreate('Users', {
      where: { googleID },
      defaults: {
        first_name,
        last_name,
        image_url,
        password,
        googleID
      }
    });
  }
  return 'NO EMAIL OR GOOGLE ID';
};

const create = (model, item) => models[model].create(item);

const updatePool = (id, key, value) => findPoolById(id)
  .then((pool) => {
    if (key === 'pool_value') {
      pool[key] += value;
    } else { pool[key] = value; }
    return pool.save()
      .then(() => console.log(`POOL ${id} ${key} UPDATED ${value}!!`));
  });


const updatePoolMember = (memberId, poolId, key, value) => {
  return findPoolMember(memberId, poolId)
    .then((member) => {
      if (key === 'contrubution_amount') {
        member[key] += value;
      } else if (key === 'withdraw_amount') {
        member[key] -= value;
      } else {
        member[key] = value;
      }
      return member.save()
        .then(() => console.log(`POOL MEMBER ${memberId} ${key} UPDATED ${value}!!`));
    });
};

const createContribution = (pool_id, pool_member_id, contribution_amount) => {
  const contribution = { pool_id, pool_member_id, contribution_amount };
  // update pool value
  return updatePool(pool_id, 'pool_value', contribution_amount)
    .then(() => updatePoolMember(pool_member_id, pool_id, 'contrubution_amount', contribution_amount))
    .then(() => create('ContributionEntry', contribution));
  // update poolmember contribution amount
};

const createPoolMember = (pool_id, pool_member_id) => {
  const contrubution_amount = 0;
  const withdraw_amount = 0;
  const poolMember = {
    pool_id,
    pool_member_id,
    contrubution_amount,
    withdraw_amount
  };
  const memberArchive = {};
  findAllPoolMembers(pool_id).then((members) => {
    members.forEach((member) => {
      if (memberArchive[member.pool_member_id]) {
        member.destroy()
          .then(succ => console.log(succ, 'DESTROYED DUPLICATE'))
          .catch(err => console.log(err, 'ERROR DESTROYING'));
      } else {
        memberArchive[member.pool_member_id] = member.pool_member_id;
      }
    });
  }).catch((err) => { console.log(err); });
  return create('PoolMembers', poolMember);
};

const createPool = (name, imageURL, description, voteConfig, creator, publicOpt) => {
  const pool = {
    name,
    imageURL,
    description,
    voteConfig,
    creator,
    public: publicOpt,
    pool_value: 0,
    members_count: 1
  };

  return create('Pools', pool)
    .then((newPool) => {
      const { id } = newPool;
      return createPoolMember(id, creator)
        .then((poolmember) => { return { poolmember, newPool }; });
    });
};

const createJoinRequest = (user_id, pool_id) => {
  const joinRequest = {
    user_id,
    pool_id
  };
  return create('JoinRequests', joinRequest);
};

module.exports = {
  createJoinRequest,
  findOrCreate,
  findOrCreateUser,
  findOne,
  findUserById,
  create,
  createPool,
  findPoolByName,
  findAllPools,
  findAll,
  createPoolMember,
  findUserByGoogle,
  findAllPoolMembers,
  updatePool,
  findPoolById,
  findPoolMember,
  createContribution,
  findAllUsers,
  updatePoolMember
};
