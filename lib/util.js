const QueryEngine = require('@comunica/query-sparql-file').QueryEngine;
const myEngine = new QueryEngine();
const N3 = require('n3');
const { v4: uuidv4 } = require('uuid');
const { DataFactory } = N3;
const { namedNode, literal, blankNode, quad } = DataFactory;
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

function makePrefixes() {
    let prefixes = '';
    for (key in NS) {
        prefixes += `@prefix ${key}: <${NS[key]}> .\n`;
    }
    return prefixes;
}

function makePolicy(options) {
    return `${makePrefixes()}
<> a odrl:Set;
    odrl:uid <${uuid_urn().value}>;
    dct:description "<changeme> What is this about?";
    dct:source <${options.source}>;
    odrl:permission  [
        a odrl:Permission;
        odrl:assignee ex:alice;
        odrl:action odrl:read;
        odrl:target ex:resourceX
    ].`; 
}

function makeRequest(options) {
    let rulePred;
    let ruleType;

    if (options.type == 'permission') {
        rulePred = "odrl:permission";
        ruleType = "odrl:Permission"
    }
    else if (options.type == 'prohibition') {
        rulePred = "odrl:prohibition";
        ruleType = "odrl:Prohibition" 
    }
    else {
        throw new Error(`need type = permission | prohibition`);
    }

    return `${makePrefixes()}
<> a odrl:Request;
    odrl:uid <${uuid_urn().value}>;
    dct:description "<changeme> description";
    ${rulePred} [
        a ${ruleType};
        odrl:assignee ex:alice;
        odrl:action odrl:read;
        odrl:target ex:resourceX
    ].
`;
}

function makeSotw() {
    const currentTime = (new Date()).toISOString();
    return `${makePrefixes()}
<> a ex:Sotw;
    ex:includes temp:currentTime, ex:example1, ex:example2.

# A sotw requires at least a temp:currentTime
temp:currentTime dct:issued "${currentTime}"^^xsd:dateTime.

ex:example1 ex:pays "12.5"^^xsd:double.

ex:example2 dct:issued "2025-06-30T13:33:34.613Z"^^xsd:dateTime.
`;
}

function makeTestcase(options) {
    let ruleType;
    let premiseReport = [];

    if (options.type == 'permission') {
        ruleType = "report:PermissionReport"
    }
    else if (options.type == 'prohibition') {
        ruleType = "report:ProhibitionReport" 
    }
    else {
        throw new Error(`need type = permission | prohibition`);
    }

    if (options.action) {
        premiseReport.push(
`[
                a report:ActionReport ;
                report:satisfactionState report:Satisfied
            ]`
        );
    }

    if (options.constraint) {
        premiseReport.push(
`[
                a report:ConstraintReport ;
                report:constraint <urn:uuid:id-of-policy-constraint>;
                report:constraintLeftOperand "Expected Left Operand";
                report:constraintOperator odrl:gt;
                report:constraintRightOperand "Expected Right Operand";
                report:satisfactionState report:Satisfied
            ]`
        );
    }

    if (options.party) {
        premiseReport.push(
`[
                a report:PartyReport ;
                report:satisfactionState report:Satisfied
            ]`
        );
    }

    if (options.target) {
        premiseReport.push(
`[
                a report:TargetReport ;
                report:satisfactionState report:Satisfied
            ]`
        );
    }

    let testCase = `${makePrefixes()}
<> a ex:TestCase;
    dct:title "Any request results into yes (Alice Request).";
    ex:policy <../data/policies/policy1.ttl>;
    ex:request <../data/requests/request1.ttl>;
    ex:sotw <../data/sotw/sotw1.ttl>;
    ex:expectedReport [ 
        a report:PolicyReport;
        report:policy <../data/policies/policy1.ttl>;
        report:policyRequest <../data/requests/request1.ttl>;
        report:ruleReport [
            a ${ruleType};
            report:attemptState report:Attempted;
            report:rule <urn:uuid:id-of-policy-rule>;
            report:ruleRequest <urn:uuid:id-of-request-rule>;`;

    if (premiseReport.length) {
        testCase += `
            report:premiseReport ${premiseReport.join(",")};`;
    }

    testCase += `
            report:activationState report:Active
        ]
    ].
`;

    return testCase;
}

async function makeGround(file) {
    return new Promise( async (resolve) => {
        const store = new N3.Store();

        const parser = new N3.Parser();
        const bnMap = {};

        const quads = parser.parse(fs.readFileSync(file,'utf-8'));

        for (let i = 0 ; i < quads.length ; i++) {
            const q = quads[i];
            let subject   = q.subject;
            let predicate = q.predicate;
            let object    = q.object;
            
            if (! bnMap[subject.value]) {
                if (subject.value.startsWith('file://') || 
                    subject.value === '' ||
                    subject.termType === 'BlankNode') {
                    bnMap[subject.value] = uuid_urn();
                }
            }

            if (! bnMap[object.value]) {
                if (object.termType === 'BlankNode') {
                    bnMap[object.value] = uuid_urn();
                }
                if (object.termType === 'NamedNode' && object.value.startsWith("/")) {
                    bnMap[object.value] = await mainSubject("." + object.value);
                }
                if (object.termType === 'NamedNode' && object.value.startsWith("file:/")) {
                    bnMap[object.value] = await mainSubject(object.value.slice("file:/".length));
                }
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

        resolve(await store2rdf(store));
    });
}

async function mainSubject(file) {
    return new Promise( (resolve,reject) => {
        const parser = new N3.Parser();
        const subjectMap = {};
        const quads = parser.parse(fs.readFileSync(file,'utf-8'));
        for (let i = 0 ; i < quads.length ; i++) {
            const q = quads[i];
            if (! subjectMap[q.subject.value]) {
                subjectMap[q.subject.value] = 1;
            }
            subjectMap[q.object.value] = -1;
        }
        const result = Object.keys(subjectMap).filter(k => subjectMap[k] === 1);
        if (result.length == 0) {
            reject(`no main subject in ${file}?!`);
        }
        if (result.length == 1) {
            resolve(result[0]);
        }
        else {
            reject(`multiple main subjects in ${file}: ${result.join(",")}`);
        }
    });
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
    makePolicy,
    makeRequest,
    makeSotw,
    makeTestcase,
    makeGround,
}