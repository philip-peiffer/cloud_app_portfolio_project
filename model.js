const gcds = require('@google-cloud/datastore')

// grab the datastore instance used for this project
const projectID = 'portfolio_project'
const ds = new gcds.Datastore({projectId: projectID})

// define function to add id to entities returned from DS
function fromStore (data) {
    data.id = data[ds.KEY].id
    return data
}

async function postItem(newData, kind) {
    // prepare the key based on kind - this will assign it to the right "table"
    const newKey = ds.key(kind)

    // prepare the entity
    const entity = {
        key: newKey,
        data: newData
    }

    // save the entity in datastore
    await ds.save(entity)

    // now add ID field to newData before returning this result so it's in the result sent back to client
    newData.id = newKey.id
    return newData
}

async function getItems(kind){
    // returns a list of all entities of a certain kind
    let query = ds.createQuery(kind)

    // run the query and extract the results / cursor information
    const results = await ds.runQuery(query)
    let data = results[0]

    // convert the data to the desired format for return
    data = data.map(fromStore)

    return data
}

async function getFilteredItems(kind, filterProp, filterVal) {
    // returns a list of all entities of a certain kind that match the filter value
    const query = ds.createQuery(kind).filter(filterProp, '=', filterVal)
    const results = await ds.runQuery(query)
    let data = results[0]
    return data.map(fromStore)
}

async function getItem(kind, id){
    // returns a single item whose id matches the parameter passed in

    // manually create a key that would match the key we're looking for by creating a new key with the 
    // same kind and ID
    const manKey = ds.key([kind, parseInt(id, 10)])
    const results = await ds.get(manKey)
    let data = results[0]

    if (data === null || data === undefined) {
        return results
    }
    
    return results.map(fromStore)
}

async function deleteItem(kind, id) {
    // deletes an item from datastore that matches the kind and id passed in
    // manually create a key that would match the key we're looking for by creating a new key with the 
    // same kind and ID
    const manKey = ds.key([kind, parseInt(id, 10)])
    const response = await ds.delete(manKey)

    return response
}

async function updateItem(newData, kind) {
    // updates an item from the datastore that matches the kind
    // NOTE - newData must be a datastore object and include an "id" field
    
    // manually create a key that would match the key we're looking for by creating a new key with the 
    // same kind and ID
    const manKey = ds.key([kind, parseInt(newData.id, 10)])

    // prepare the entity object
    delete newData.id

    const newEntity = {
        key: manKey,
        data: newData
    }

    // update the datastore item and return the key
    await ds.save(newEntity)
    newData.id = manKey.id
    return newData
}

module.exports = {
    postItem,
    getItem,
    getFilteredItems,
    getItems,
    deleteItem,
    updateItem
}