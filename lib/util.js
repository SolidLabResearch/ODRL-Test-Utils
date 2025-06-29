const QueryEngine = require('@comunica/query-sparql-file').QueryEngine;
const myEngine = new QueryEngine();
const N3 = require('n3');
const { v4: uuidv4 } = require('uuid');
const { DataFactory } = N3;
const { namedNode, literal, blankNode, quad, defaultGraph } = DataFactory;
const fs = require('fs');

const NS = { 
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' ,
    odrl: 'http://www.w3.org/ns/odrl/2/' ,
    ex: 'http://example.org/' ,
    temp: 'http://example.com/request/' ,
    dct: 'http://purl.org/dc/terms/',
    xsd: 'http://www.w3.org/2001/XMLSchema#' ,
    foaf: 'http://xmlns.com/foaf/0.1/' ,
    report: 'https://w3id.org/force/compliance-report#'
};

async function makePolicy(options) {
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        addPolicy(store,options);
       
        resolve (await store2rdf(store));
    });
}

function addPolicy(store,options) {
    const set_id = uuid_urn();
    const perm_id = uuid_urn();

    store.add( quad(set_id, url('rdf:type'), url('odrl:Set')) );
    store.add( quad(set_id, url('odrl:uid'), set_id) );
    store.add( quad(set_id, url('odrl:description'), text("<changeme> What is this about?")) );
    store.add( quad(set_id, url('odrl:source'), url(options.source)) );
    store.add( quad(set_id, url('odrl:permission'), perm_id) );

    store.add( quad(perm_id, url('rdf:type'), url('odrl:Permission')) );
    store.add( quad(perm_id, url('odrl:assignee'), url('ex:alice')) );
    store.add( quad(perm_id, url('odrl:action'), url('odrl:read')) );
    store.add( quad(perm_id, url('odrl:target'), url('ex:resourceX')) );
}

async function makeConstraint() {
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        const const_id = uuid_urn();
        store.add( quad(const_id, url('odrl:leftOperand'), url('odrl:dateTime')) );
        store.add( quad(const_id, url('odrl:operator'), url('odrl:lt')) );
        store.add( quad(const_id, url('odrl:rightOperand'), text("2024-02-12T11:20:10.999Z","xsd:dateTime")) );

        resolve(await store2rdf(store));
    });
}

async function makeRequest() {
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        const req_id = uuid_urn();
        const uid_id = uuid_urn();
        const perm_id = uuid_urn();

        store.add( quad(req_id, url('rdf:type'), url('odrl:Request')) );
        store.add( quad(req_id, url('odrl:uid'), uid_id) );
        store.add( quad(req_id, url('dct:description'), text('<changeme> description')) );
        store.add( quad(req_id, url('odrl:permission'), perm_id) );
       
        store.add( quad(perm_id, url('rdf:type'), url('odrl:Permission')) );
        store.add( quad(perm_id, url('odrl:assignee'), url('ex:bob')) );
        store.add( quad(perm_id, url('odrl:action'), url('odrl:read')) );
        store.add( quad(perm_id, url('odrl:target'), url('ex:x')) );

        resolve(await store2rdf(store));
    });
}

async function makeSotw() {
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        const sotw_id = uuid_urn();

        store.add( quad(sotw_id, url('rdf:type'), url('ex:Sotw')) );
        store.add( quad(sotw_id, url('ex:includes'), url('ex:example1')) );
        store.add( quad(sotw_id, url('ex:includes'), url('ex:example2')) );

        store.add( quad( url('ex:example1'), url('ex:pays'), text(12.50)) );
        store.add( quad( url('ex:example2'), url('dct:issued'), text((new Date()).toISOString(),'xsd:dateTime')) );

        resolve(await store2rdf(store));
    });
}

async function makeTestCase(file) {
    return new Promise( async (resolve,reject) => {
        const store = new N3.Store();

        const parsedTest = await parseTestCase(file);
        
        const parser = new N3.Parser();
        let mainSubject = null;
        const bnMap = {};

        parser.parse(fs.readFileSync(file,'utf-8'),
            async (e,q,_) => {
                if (e) {
                    reject(e);
                }
                if (q) {
                    let subject   = q.subject;
                    let predicate = q.predicate;
                    let object    = q.object;

                    if (mainSubject && subject.value === mainSubject.value) {
                        if (predicate.value === url('ex:policy').value) {
                            object = parsedTest.policy;
                        }
                        else if (predicate.value === url('ex:request').value) {
                            object = parsedTest.request;
                        }
                        else if (predicate.value === url('ex:sotw').value) {
                            object = parsedTest.sotw;
                        }
                    }

                    if (predicate.value === url('rdf:type').value &&
                        object.value === url('ex:TestCase').value) {
                        bnMap[subject.value] = uuid_urn();
                        mainSubject = subject;
                        subject = bnMap[subject.value];
                    }

                    if (subject.termType === 'BlankNode' && ! bnMap[subject.value]) {
                        bnMap[subject.value] = uuid_urn();
                    }
                    if (object.termType === 'BlankNode' && ! bnMap[object.value]) {
                        bnMap[object.value] = uuid_urn();
                    }

                    if (bnMap[subject.value]) {
                        subject = bnMap[subject.value];
                    }

                    if (bnMap[object.value]) {
                        object = bnMap[object.value];
                    }

                    store.add(
                        quad(
                            subject,
                            predicate,
                            object
                        )
                    );
                }
                else {
                    resolve(await store2rdf(store));
                }
        });
    });
}

async function parseTestCase(file) {
    const bindingsStream = await myEngine.queryBindings(`
        PREFIX ex: <http://example.org/>
        PREFIX dct: <http://purl.org/dc/terms/>
        SELECT ?s ?title ?policy ?request ?sotw WHERE {
            ?s a ex:TestCase .
            ?s ex:policy ?policy .
            OPTIONAL { ?s dct:title ?title . }
            OPTIONAL { ?s ex:request ?request . }
            OPTIONAL { ?s ex:sotw ?sotw . }
        }`, {
        sources: [file]
    });

    const FILE_PREFIX = 'file://';
    const bindings = await bindingsStream.toArray();

    if (bindings.length == 0) {
        return null;
    }

    const title   = bindings[0].get('title')?.value;
    let policy    = bindings[0].get('policy').value;
    let request   = bindings[0].get('request')?.value;
    let sotw      = bindings[0].get('sotw')?.value;

    if (policy.startsWith(FILE_PREFIX)) {
        const ids = await fileIds(policy.slice(FILE_PREFIX.length),'odrl:Set');
        if (ids.length > 0) {
            policy = namedNode(ids[0].value);
        }
    }

    if (request && request.startsWith(FILE_PREFIX)) {
        const ids = await fileIds(request.slice(FILE_PREFIX.length),'odrl:Request');
        if (ids.length > 0) {
            request = namedNode(ids[0].value);
        }
    }

    if (sotw && sotw.startsWith(FILE_PREFIX)) {
        const ids = await fileIds(sotw.slice(FILE_PREFIX.length),'ex:Sotw');
        if (ids.length > 0) {
            sotw = namedNode(ids[0].value);
        }
    }

    return  { title, policy, request , sotw };
}

async function fileIds(file,what) {
    const whatUrl = url(what).value;
    const bindingsStream = await myEngine.queryBindings(`
        SELECT ?s WHERE {
            ?s a <${whatUrl}> 
        }`, {
        sources: [file]
    });

    const ids = [];

    for await (const bindings of bindingsStream) {
        ids.push(url(bindings.get('s').value));
    }
    
    return ids;
}

async function store2rdf(store) {
    return new Promise( (resolve) => {
        const writer = new N3.Writer({ prefixes: NS }); 

        for (const quad of store) {
            writer.addQuad(quad);
        }

        writer.end((_, result) => resolve(result));
    });
}

function uuid_urn() {
    return namedNode(`urn:uuid:` + uuidv4());
}

function url(str) {
    const parts = str.split(':',2);
    if (NS[parts[0]]) {
        return namedNode(NS[parts[0]] + parts[1])
    }
    else {
        return namedNode(str);
    }
}

function text(str,type){
    if (type) {
        return literal(str,url(type));
    }
    else {
        return literal(str);
    }
}

module.exports = {
    makeConstraint,
    makePolicy,
    makeRequest,
    makeSotw,
    makeTestCase,
}