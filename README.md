# ODRL Test Utils

## Install

```
npm install
```

## Synopsis

```
# Create a sample policy
npx odrl_test_utils sample policy

# Create a sample request
npx odrl_test_request sample request

# Create a sample state of the world (sotw)
npx odrl_test_utils sample sotw

# Create a sample test case
npx odrl_test_utils sample testcase

# Ground an RDF document 
#  - Replace all blank nodes by UUIDs
#  - Replace all paths to local files by their 'main subject' 
#    - The subject that is not part of any object
npx odrl_test_utils ground example/policy1.ttl

# The same but overwrite the existing file
npx odrl_test_utils ground -x example/policy1.ttl
```