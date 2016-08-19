### D3.js implementation of PivotGraph (http://hint.fm/papers/pivotgraph.pdf)

Based on Mike Bostock's Gist https://gist.github.com/mbostock/4343153

Uses D3.js (version 3.3.2) from CloudFlare CDN

JSON dataset format - provide node/link properties highlighted below for better user experience
```
{
   "links" : [
       {
           "rsDisplay" : "bla bla", 	// description/label of link
           "source" : 0,
           "target" : 2,				// source & target attributes are elements in the nodes array, specified as indexes into the nodes array
           "value" : 10 				// tentative feature: value attribute contributes to the weight/thickness of the link
           ...
       },
       ...
   ],
   "nodes" : [
       {
           "oid" : "0asq21kp",			// a unique identifier (alpha and/or numeric)
           "name" : "孙门张氏千娘 曾祖母"	// if node is to be listed in the "i am who?" drop-down list
       },
       ...
   ]
}
```
