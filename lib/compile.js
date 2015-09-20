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
            var rule = buildRule(name, rules[i], emitNewStructure);
            if (opts.nojs) {
                rule.postprocess = null;
            }
            result.rules.push(rule);
        }
        return name;
    }

    function emitNewStructure(name, rules) {
        return produceRules(unique(name), rules);
    }
}

function buildRule(ruleName, rule, emit) {
    var tokens = [];
    for (var i = 0; i < rule.tokens.length; i++) {
        var token = buildToken(ruleName, rule.tokens[i], emit);
        if (token) {
            tokens.push(token);
        }
    }
    return new nearley.Rule(
        ruleName,
        tokens,
        rule.postprocess
    );
}

function buildToken(ruleName, token, emit) {
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

    if (token.resolved) {
        return token.resolved;
    }

    if (token.literal) {
        if (!token.literal ||
            !token.literal.length) {
            return null;
        }
        if (token.literal.length === 1) {
            return token;
        }
        token.resolved = buildStringToken(ruleName, token, emit);
        return token.resolved;
    }

    if (token.subexpression) {
        token.resolved = buildSubExpressionToken(ruleName, token, emit);
        return token.resolved;
    }

    if (token.ebnf) {
        token.resolved = buildEBNFToken(ruleName, token, emit);
        return token.resolved;
    }

    throw new Error("unrecognized token: " + JSON.stringify(token));
}

function buildStringToken(ruleName, token, emit) {
    return emit(ruleName + "$string", [
        {
            tokens: token.literal.split("").map(function charLiteral(d) {
                return {
                    literal: d
                };
            }),
            postprocess: joiner
        }
    ]);
}

function buildSubExpressionToken(ruleName, token, emit) {
    return emit(ruleName + "$subexpression", token.subexpression);
}

function buildEBNFToken(ruleName, token, emit) {
    switch (token.modifier) {
        case ":+":
            return buildEBNFPlus(ruleName, token, emit);
        case ":*":
            return buildEBNFStar(ruleName, token, emit);
        case ":?":
            return buildEBNFOpt(ruleName, token, emit);
    }
}

function buildEBNFPlus(ruleName, token, emit) {
    return emit(ruleName + "$plus", [
        {
            tokens: [token.ebnf],
        }, {
            tokens: [token.ebnf, $self],
            postprocess: arrconcat
        }
    ]);
}

function buildEBNFStar(ruleName, token, emit) {
    return emit(ruleName + "$star", [
        {
            tokens: [],
        }, {
            tokens: [token.ebnf, $self],
            postprocess: arrconcat
        }
    ]);
}

function buildEBNFOpt(ruleName, token, emit) {
    return emit(ruleName + "$opt", [
        {
            tokens: [token.ebnf],
            postprocess: "id"
        }, {
            tokens: [],
            postprocess: "function(d) {return null;}"
        }
    ]);
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
