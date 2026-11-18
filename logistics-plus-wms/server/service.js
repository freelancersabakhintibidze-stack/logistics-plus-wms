const repository = require('./repository');

// Business-service boundary. HTTP handlers depend on this module, never directly
// on SQL. Workflow policy and verification gates belong here as they are approved;
// today every operation below is read-only.
module.exports = {
  listProducts: query => repository.listProducts(query),
  listInventory: query => repository.listInventory(query),
  listOrders: query => repository.listOrders(query),
  getOrder: id => repository.getOrder(id),
  dashboard: () => repository.dashboard()
};
