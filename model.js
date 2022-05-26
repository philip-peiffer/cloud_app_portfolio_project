const gcds = require('@google-cloud/datastore')

// grab the datastore instance used for this project
const projectID = 'portfolio-peifferp'
const ds = new gcds.Datastore({projectId: projectID})

// define function to add id to entities returned from DS
function fromStore (data) {
    data.id = data[ds.KEY].id
    return data
}

/**
 * Posts a new entity to datastore that matches the newData object parameter. Returns this new entity with the "id" attribute
 * added.
 * NOTE - use this function when wanting to supply ID for datastore manually. If OK with DS assigning an ID instead, use postItem
 * @param {obj} newData 
 * @param {str} id 
 * @param {str} kind 
 * @returns 
 */
async function postItemManId(newData, id, kind) {
    // prepare the key based on kind - this will assign it to the right "table" - and manual id
    const newKey = ds.key([kind, id])

    // prepare the entity
    const entity = {
        key: newKey,
        data: newData
    }

    await ds.save(entity)

    newData.id = newKey.name
    return newData
}

/**
 * Posts a new entity to datastore that matches the newData object parameter. Returns this new entity with the "id" attribute
 * added.
 * NOTE - use this function only if OK with datastore creating id automatically. If you need to assign a manual id, use postItemManId
 * @param {obj} newData 
 * @param {str} kind 
 * @returns Entity Object
 */
async function postItem(newData, kind) {
    // prepare the key based on kind - this will assign it to the right "table"
    const newKey = ds.key(kind)

    // prepare the entity
    const entity = {
        key: newKey,
        data: newData
    }

    await ds.save(entity)

    newData.id = newKey.id
    return newData
}

/**
 * Queries the kind group specified, projecting to keys only for faster query. Returns an array of entity keys.
 * @param {str} kind 
 * @returns Array of entity keys
 */
async function queryKeysOnly (kind) {
    // this function queries the datastore for entities that match the specified kind, but only returns the keys (not the whole entity)
    const query = ds.createQuery(kind).select('__key__')
    const results = await ds.runQuery(query)
    return results[0]
}

/**
 * Returns a list of all entities in datastore within the kind group specified. Results are not paginated. If no entities exist, 
 * returns a blank array.
 * @param {str} kind 
 * @returns Array of entities
 */
async function getItemsNoPaginate(kind){
    let query = ds.createQuery(kind)
    const results = await ds.runQuery(query)
    let data = results[0]

    // convert the data to the desired format for return
    data = data.map(fromStore)

    return data
}

/**
 * Returns a list of all entities within the kind group specified. Results are paginated to 3 items per page.
 * Returns an object like so:
 * {
 *   next: cursor_token,
 *   total: total items in kind,
 *   data: entities
 * }
 * @param {str} kind 
 * @param {str} pageCursor 
 * @returns Query Object
 */
async function getItemsPaginate (kind, pageCursor=undefined) {
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

/**
 * Returns an array of datastore entities whose filterProp = filterVal. If no entities are found, returns an empty array.
 * @param {str} kind 
 * @param {str} filterProp 
 * @param {any} filterVal 
 * @returns Array of entities
 */
async function getFilteredItems(kind, filterProp, filterVal) {
    const query = ds.createQuery(kind).filter(filterProp, '=', filterVal)
    const results = await ds.runQuery(query)
    let data = results[0]
    return data.map(fromStore)
}

/**
 * Returns an array with a single entity from datastore whose id matches the id parameter. If no match found, array is empty.
 * NOTE - manualId = true must be used for entities whose key id's are not automatically created by datastore.
 * @param {str} kind 
 * @param {str} id 
 * @param {bool} manualId 
 * @returns Array with single entity
 */
async function getItem(kind, id, manualId=false){
    // manually create matching key
    let manKey = null
    if (manualId) {
        manKey = ds.key([kind, id])
    } else {
        manKey = ds.key([kind, parseInt(id, 10)])
    }

    const results = await ds.get(manKey)

    if (results[0] === null || results[0] === undefined) {
        return results
    }
    
    return results.map(fromStore)
}

/**
 * Deletes an item from the datastore that matches the kind and id passed as parameters.
 * @param {str} kind 
 * @param {str} id 
 * @returns 
 */
async function deleteItem(kind, id) {
    // manually create matching key
    const manKey = ds.key([kind, parseInt(id, 10)])
    const response = await ds.delete(manKey)

    return response
}

/**
 * Updates an item from the "kind" entity group that matches the ID in the newData object. Returns a single object (not array)
 * NOTE - newData must have an "id" field that contains the id of the datastore entity to be updated.
 * NOTE - manualId = true must be used for entities that are not assigned keys automatically by datastore.
 * @param {object} newData 
 * @param {str} kind 
 * @param {bool} manualId 
 * @returns Updated Entity
 */
async function updateItem(newData, kind, manualId=false) {
    // manually create matching key 
    let manKey = null
    let existId = newData.id
    if (manualId) {
        manKey = ds.key([kind, id])
    } else {
        manKey = ds.key([kind, parseInt(id, 10)])
    }

    // prepare the entity object
    delete newData.id

    const newEntity = {
        key: manKey,
        data: newData
    }

    // update the datastore item and return the key
    await ds.save(newEntity)
    newData.id = existId
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