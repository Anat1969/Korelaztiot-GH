"""Print the newest Overture Maps release id from the public S3 listing."""
import re, urllib.request
xml = urllib.request.urlopen('https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/', timeout=60).read().decode()
print(sorted(re.findall(r'<Prefix>release/([\d.-]+)/</Prefix>', xml))[-1])
