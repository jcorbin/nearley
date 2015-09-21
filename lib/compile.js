(function () {
if (typeof(window) === 'undefined') {
    var nearley = require('../lib/nearley.js');
} else {
    var nearley = window.nearley;
}

// a sentinel for late-resolving self-referential rules
var $self = {};

function Compile(structure, opts) {
    var unique = uniquer();

    var result = {
        rules: [],
        body: [], // @directives list
        start: ''
    };

    for (var i = 0; i < structure.length; i++) {
        var productionRule = structure[i];
        if (productionRule.body) {
            // This isn't a rule, it's an @directive.
            if (!opts.nojs) {
                result.body.push(productionRule.body);
            }
        } else {
            produceRules(productionRule.name, productionRule.rules);
            if (!result.start) {
                result.start = productionRule.name;
            }
        }
    }

    return result;

    function produceRules(name, rules) {
        for (var i = 0; i < rules.length; i++) {
            var rule = buildRule(name, rules[i]);
            if (opts.nojs) {
                rule.postprocess = null;
            }
            result.rules.push(rule);
        }
    }

    function emitNewStructure(name, rules) {
        name = unique(name);
        structure.push({
           name: name,
           rules: rules
        });
        return name;
    }

    function buildRule(ruleName, rule) {
        var tokens = [];
        for (var i = 0; i < rule.tokens.length; i++) {
            var token = buildToken(ruleName, rule.tokens[i]);
            if (token !== null) {
                tokens.push(token);
            }
        }
        return new nearley.Rule(
            ruleName,
            tokens,
            rule.postprocess
        );
    }

    function buildToken(ruleName, token) {
        if (typeof token === 'string') {
            if (token === 'null') {
                return null;
            }
            return token;
        }

        if (token instanceof RegExp) {
            return token;
        }

        if (token === $self) {
            return ruleName;
        }

        if (token.literal) {
            if (!token.literal ||
                !token.literal.length) {
                return null;
            }
            if (token.literal.length === 1) {
                return token;
            }
            return buildStringToken(ruleName, token);
        }

        if (token.subexpression) {
            return buildSubExpressionToken(ruleName, token);
        }

        if (token.ebnf) {
            return buildEBNFToken(ruleName, token);
        }

        throw new Error("unrecognized token: " + JSON.stringify(token));
    }

    function buildStringToken(ruleName, token) {
        var newname = unique(ruleName + "$string");
        produceRules(newname, [
            {
                tokens: token.literal.split("").map(function charLiteral(d) {
                    return {
                        literal: d
                    };
                }),
                postprocess: joiner
            }
        ]);
        return newname;
    }

    function buildSubExpressionToken(ruleName, token) {
        return emitNewStructure(ruleName + "$subexpression", token.subexpression);
    }

    function buildEBNFToken(ruleName, token) {
        switch (token.modifier) {
            case ":+":
                return buildEBNFPlus(ruleName, token);
            case ":*":
                return buildEBNFStar(ruleName, token);
            case ":?":
                return buildEBNFOpt(ruleName, token);
        }
    }

    function buildEBNFPlus(ruleName, token) {
        return emitNewStructure(ruleName + "$ebnf", [
            {
                tokens: [token.ebnf],
            }, {
                tokens: [token.ebnf, $self],
                postprocess: arrconcat
            }
        ]);
    }

    function buildEBNFStar(ruleName, token) {
        return emitNewStructure(ruleName + "$ebnf", [
            {
                tokens: [],
            }, {
                tokens: [token.ebnf, $self],
                postprocess: arrconcat
            }
        ]);
    }

    function buildEBNFOpt(ruleName, token) {
        return emitNewStructure(ruleName + "$ebnf", [
            {
                tokens: [token.ebnf],
                postprocess: "id"
            }, {
                tokens: [],
                postprocess: "function(d) {return null;}"
            }
        ]);
    }
}

function uniquer() {
    var uns = {};
    return unique;
    function unique(name) {
        var un = uns[name] = (uns[name] || 0) + 1;
        return name + '$' + un;
    }
}

function arrconcat(d) {
    return [d[0]].concat(d[1]);
}

function joiner(d) {
    return d.join('');
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Compile;
} else {
    window.Compile = Compile;
}
})();
