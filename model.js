const gcds = require('@google-cloud/datastore')

// grab the datastore instance used for this project
const projectID = 'portfolio-peifferp'
const ds = new gcds.Datastore({projectId: projectID})

// define function to add id to entities returned from DS
function fromStore (data) {
    data.id = data[ds.KEY].id
    return data
}

async function postItemManId(newData, id, kind) {
    // prepare the key based on kind - this will assign it to the right "table"
    const newKey = ds.key([kind, id])

    // prepare the entity
    const entity = {
        key: newKey,
        data: newData
    }

    // save the entity in datastore
    await ds.save(entity)

    // now add ID field to newData before returning this result so it's in the result sent back to client
    newData.id = newKey.name
    return newData
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

async function queryKeysOnly (kind) {
    // this function queries the datastore for entities that match the specified kind, but only returns the keys (not the whole entity)
    const query = ds.createQuery().select('__key__')
    const results = await ds.runQuery(query)
    return results
}

async function getItemsNoPaginate(kind){
    // returns a list of all entities of a certain kind
    let query = ds.createQuery(kind)

    // run the query and extract the results / cursor information
    const results = await ds.runQuery(query)
    let data = results[0]

    // convert the data to the desired format for return
    data = data.map(fromStore)

    return data
}

async function getItemsPaginate (kind, pageCursor=undefined) {
    // returns a list of all entities of a certain kind, paginated 
    // first query only on key to get full count
    const totalResults = await queryKeysOnly()
    const total = totalResults.length

    // now run paginated query
    let query = ds.createQuery(kind).limit(3)
    if (pageCursor !== undefined){
        query = query.start(pageCursor)
    }

    const results = await ds.runQuery(query)
    const data = results[0]
    const cursorInfo = results[1]
    let token = null

    // convert the data to the desired format for return
    data = data.map(fromStore)

    // set the token value for return if more results can be obtained
    if (cursorInfo.moreResults !== ds.NO_MORE_RESULTS) {
        token = cursorInfo.endCursor
    }

    let returnObj = {next: token, total: total}
    returnObj[kind] = data

    return returnObj
}

async function getFilteredItems(kind, filterProp, filterVal) {
    // returns a list of all entities of a certain kind that match the filter value
    const query = ds.createQuery(kind).filter(filterProp, '=', filterVal)
    const results = await ds.runQuery(query)
    let data = results[0]
    return data.map(fromStore)
}

async function getItem(kind, id, manualId=false){
    // returns a single item whose id matches the parameter passed in

    // manually create a key that would match the key we're looking for by creating a new key with the 
    // same kind and ID
    let manKey = null
    if (manualId) {
        manKey = ds.key([kind, id])
    } else {
        manKey = ds.key([kind, parseInt(id, 10)])
    }

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
    postItemManId,
    getItem,
    getFilteredItems,
    getItemsPaginate,
    getItemsNoPaginate,
    deleteItem,
    updateItem
}