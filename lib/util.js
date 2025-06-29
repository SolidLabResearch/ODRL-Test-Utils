const QueryEngine = require('@comunica/query-sparql-file').QueryEngine;
const myEngine = new QueryEngine();
const N3 = require('n3');
const { v4: uuidv4 } = require('uuid');
const { DataFactory } = N3;
const { namedNode, literal, blankNode, quad, defaultGraph } = DataFactory;

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

    const bn = blankNode('thisIs');

    store.add( quad(bn, url('rdf:type'),url('ex:PolicyDemo')));
    store.add( quad(bn, url('dct:title'),text('<changeme>Test title')));
    store.add( quad(bn, url('dct:description'),text('<changeme> Test description')));

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
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        const test_id = uuid_urn();
        const report_id = uuid_urn();
        const policy_id = await policyFileIds(file);
        const policy_metadata = await policyFileMetadata(file);
        const rule_id = uuid_urn();

        store.add( quad(test_id, url('rdf:type'), url('ex:TestCase')) );
        store.add( quad(test_id, url('rdf:type'), url('ex:ConflictTestCase')) );
        store.add( quad(test_id, url('dct:title'), text(policy_metadata['title'])) );
        for (let i = 0 ; i < policy_id.length; i++) {
            store.add( quad(test_id, url('report:policy'), policy_id[i]));
        }
        store.add( quad(test_id, url('ex:expectedReport'), report_id) );
        store.add( quad(report_id, url('rdf:type'), url('report:PolicyReport')) );
        store.add( quad(report_id, url('rdf:type'), url('report:ConflictPolicyReport')) );
        store.add( quad(report_id, url('dct:created'), text((new Date()).toISOString(),'xsd:dateTime')) );
        store.add( quad(report_id, url('report:ruleReport'), rule_id));

        store.add( quad(rule_id, url('rdf:type'), url('report:Report')));
        store.add( quad(rule_id, url('rdf:type'), url('report:ConflictReport')));
        store.add( quad(rule_id, url('report:attemptState'), url('report:Attempted')));
        store.add( quad(rule_id, url('report:activationState'), url(policy_metadata['activationState'])));

        resolve(await store2rdf(store));
    });
}

async function policyFileMetadata(file) {
    const bindingsStream = await myEngine.queryBindings(`
        PREFIX ex: <http://example.org/>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX report: <https://w3id.org/force/compliance-report#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
        SELECT ?title ?description ?policyDescription ?state WHERE {
            ?s a ex:PolicyDemo .
            ?s dct:title ?title .
            OPTIONAL { ?s dct:description ?description . }
            OPTIONAL { ?s report:activationState ?state .  }
            OPTIONAL { 
                ?t a odrl:Set .
                ?t odrl:description ?policyDescription .  
            }
        }`, {
        sources: [file]
    });

    const metadata = {
        'title': '',
        'description': '',
        'policyDescription': '',
        'activationState': 'report:Conflict'
    };

    const bindings = await bindingsStream.toArray();

    for (let i = 0 ; i < bindings.length ; i++) {
        const binding = bindings[i];
        if (binding.get('title')) {
            metadata['title'] = binding.get('title').value;
        }

        if (binding.get('description')) {
            metadata['description'] = binding.get('description').value;
        }
        
        if (binding.get('policyDescription')) {
            metadata['policyDescription'] += binding.get('policyDescription').value + "\n";
        }

        if (binding.get('state')) {
            metadata['activationState'] = binding.get('state').value;
        }
    }

    return metadata;
}

async function policyFileIds(file) {
    const bindingsStream = await myEngine.queryBindings(`
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
        SELECT ?s WHERE {
            ?s a odrl:Set
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
    policyFileMetadata
}