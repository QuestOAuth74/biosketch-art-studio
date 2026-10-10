1.  Cropping tool disappeared during one of our previous updates. We can
    redesign it. We can have a free form crop (with anchor points),
    circle and square.

> ![](media/image1.png){width="4.5811821959755035in"
> height="3.6933333333333334in"}

2.  Manipulating objects on the canvas when there are a few icons on it
    leads to significant lag. I am not sure what the best workaround is.
    It does lead to poor user experience. A case in point will be
    repeated icons (membrane tool) for example. When there are a lot of
    icons, we get the error PROJECT TOO LARGE TO SAVE. This error is for
    more than 4MB of icons on the canvas.

3.  Uploading new SVG icons is now buggy. Icons successfully upload,
    however, they do not appear on the canvas when clicked. I have
    attached the zip file of the recent SVG files.

4.  Reforming of lines (orthogonal, smart connectors, curved lines,
    straight lines). I have attached screen shots of a menu system we
    can use for all lines. Also, we should have the option to change the
    start and end points for lines. It can be a before, or after
    arrowpoint, circle, dot, diamond, inhibitor bar or null point. There
    is a line or curved arrow fade out tool I implemented with our
    current setup. For the line gradient property, lets change the
    default to fade in (signal amplification) and set direction to
    reverse. This is the set up that allows the arrow to appear
    correctly. See the display image

![](media/image2.png){width="6.5in" height="6.240277777777778in"}

![](media/image3.png){width="6.493055555555555in"
height="4.9534722222222225in"}

![](media/image4.png){width="5.373611111111111in"
height="3.3534722222222224in"}

![](media/image5.png){width="2.6131944444444444in"
height="4.126388888888889in"}

5.  Icons display

For icons in a particular category, let us switch to the previous
pagination style of 20 icons being displayed at a time. This allows for
more efficient use of space. The user does not need to keep scrolling up
or down vertically for categories with a large number of icons.

![](media/image6.png){width="2.446527777777778in"
height="5.940277777777778in"}

6.  The current search functionality implement by the AI is not user
    friendly. We can have a system where icons can have similar tags or
    similar names that will allow them to show up in a search.

I will say that we can create a tagging system where each icon can have
up to three alternative or similar names for search purposes. If the
user types a name which is similar, that icon will show up as a final
result. Also allow partial words close to the search term to also
populate the final result page.

For the admin page, we can have an icon name or tagging import and
export feature. I can download the names of all icons in a CSV format. I
can then create tags for each icon name and then reupload the CSV via
the admin dashboard. This will then automatically update the tags in the
database for search functionality.

7.  CANVAS size

The canvas size now does not change when a user clicks a premade style.
This used to be okay.

8.  Collaboration for scientists.

Allow a user to create a group account. They can send an invitation to a
member of their lab. User will have to sign up, activate their account
and accept invitation to collaborate on either individual projects or a
user project page. Users can create their own project pages to host
multiple projects they can share with invitees. Users can then edit and
leave comments in a comment section of the live canvas. This will allow
for more efficient collaboration.

9.  AI assisted drawing

I have been working on demos of an AI assisted drawing feature. Tried
them in manus AI and lovable. The problem with current AI assisted
drawing is that they all create flat images which cannot be edited for
scientific purposes. Consequently, journals tend to reject them.

There is an open source solution called SCISKETCH which is similar to
what I created with the AI figure generator (ADMIN ONLY).

The idea is that AI creates a JSON file showing the exact position of
icons (tagged correctly in our database), text, connectors. This is then
rendered onto our canvas. User can then make additional changes to it.
This rapidly speeds up illustration assembly time for scientists.

Unlike traditional AI-generated illustrations, which produce random
icons not scientifically vetted, our icons in the database are vetted
and accurate. This will allow for this to be submitted to journals.

One good thing about scisketch is that it was trained on over 30000
images in the journal, Cell. I have attached the link to github,
published paper and zipped JSON files which were used in training
SCISKETCH.

I have both gemini and chat gpt API for AI testing. Let me know when you
need them.

What we are seeking to do is integrate scisketch into our AI figure
generator. Looking at the code for scisketch, they use OPEN AI. We can
use our open AI key if it will make it easier to implement.

I have attached the biosketch-scisketch integration guide. Not sure if
it will be helpful but that is how I got it working in manus AI.

The current AI figure generator uses a similar workflow, however I think
using scisketch would be much better.

![](media/image7.png){width="6.493055555555555in"
height="4.420138888888889in"}

![](media/image8.png){width="6.493055555555555in"
height="4.373611111111111in"}
