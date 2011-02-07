#! /usr/bin/perl -p

# Normalize many (but not yet all!) insignificant differences in
# floating point output.

for (substr($_,index($_,')'))) {
    s/[-+](?:nan|inf)\.0[-+](?:nan|inf)\.0i/+nan.0+nan.0i/;
    s/\.(?!\d)/.0/g;
    s/[-+]0\.0i//g;
    s/[-+]?\b0\.0\b/+0.0/g;
    s/\.e/e/g;
    s/\b(-?\d+(?=[.e])(?:\.\d+)?(?:e[-+]?\d+)?)(?=i|\b)/ "#i" . ($1 + 0) /eg;
}
