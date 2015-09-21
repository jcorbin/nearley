(function () {
if (typeof(window) === 'undefined') {
    var nearley = require('../lib/nearley.js');
} else {
    var nearley = window.nearley;
}

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

    function buildRule(ruleName, rule) {
        var tokens = [];
        for (var i = 0; i < rule.tokens.length; i++) {
            var token = buildToken(ruleName, rule.tokens[i]);
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

    function buildToken(ruleName, token) {
        if (token.literal) {
            var str = token.literal;
            if (str.length > 1) {
                return buildStringToken(ruleName, token);
            } else if (str.length === 1) {
                return {
                    literal: str
                };
            } else {
                return undefined;
            }
        }

        if (token.subexpression) {
            return buildSubExpressionToken(ruleName, token);
        }

        if (token.ebnf) {
            return buildEBNFToken(ruleName, token);
        }

        if (typeof(token) === 'string') {
            if (token !== 'null') return token;
            else return undefined;
        }

        if (token instanceof RegExp) {
            return token;
        }

        throw new Error("Should never get here");
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
        var data = token.subexpression;
        var name = unique(ruleName + "$subexpression");
        structure.push({"name": name, "rules": data});
        return name;
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
        var name = unique(ruleName + "$ebnf");
        structure.push({
            name: name,
            rules: [{
                tokens: [token.ebnf],
            }, {
                tokens: [token.ebnf, name],
                postprocess: arrconcat
            }]
        });
        return name;
    }

    function buildEBNFStar(ruleName, token) {
        var name = unique(ruleName + "$ebnf");
        structure.push({
            name: name,
            rules: [{
                tokens: [],
            }, {
                tokens: [token.ebnf, name],
                postprocess: arrconcat
            }]
        });
        return name;
    }

    function buildEBNFOpt(ruleName, token) {
        var name = unique(ruleName + "$ebnf");
        structure.push({
            name: name,
            rules: [{
                tokens: [token.ebnf],
                postprocess: "id"
            }, {
                tokens: [],
                postprocess: "function(d) {return null;}"
            }]
        });
        return name;
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
