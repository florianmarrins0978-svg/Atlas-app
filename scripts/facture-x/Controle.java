import java.io.File;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.XPathCompiler;
import net.sf.saxon.s9api.XdmDestination;
import net.sf.saxon.s9api.XdmItem;
import net.sf.saxon.s9api.XsltExecutable;
import net.sf.saxon.s9api.XsltTransformer;

/*
 * Le contrôle officiel d'un XML de Factur-X, en deux temps : le schéma CII
 * D16B (la forme), puis les règles EN 16931 publiées par la Commission
 * européenne (le fond : totaux, TVA, mentions). Les deux fichiers sont ceux
 * de ConnectingEurope/eInvoicing-EN16931, à un commit fixé
 * (`scripts/_outils-facture-x.mjs`).
 *
 * Une ligne par faute, « fichier<TAB>règle<TAB>texte », et rien d'autre :
 * la suite qui l'appelle (`scripts/test-facture-x.ts`) lit ces lignes.
 * Une ligne « fichier<TAB>LU » dit qu'un fichier a bien été lu jusqu'au bout,
 * pour qu'un contrôle muet ne passe jamais pour un contrôle vert.
 */
public class Controle {
  public static void main(String[] args) throws Exception {
    Schema schema = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI).newSchema(new File(args[0]));
    Processor processeur = new Processor(false);
    XsltExecutable regles = processeur.newXsltCompiler().compile(new StreamSource(new File(args[1])));
    XPathCompiler xpath = processeur.newXPathCompiler();
    xpath.declareNamespace("svrl", "http://purl.oclc.org/dsdl/svrl");
    for (int i = 2; i < args.length; i++) {
      File fichier = new File(args[i]);
      try {
        schema.newValidator().validate(new StreamSource(fichier));
      } catch (org.xml.sax.SAXException e) {
        System.out.println(fichier.getName() + "\tXSD\t" + e.getMessage().replace('\n', ' '));
      }
      XsltTransformer t = regles.load();
      XdmDestination sortie = new XdmDestination();
      t.setSource(new StreamSource(fichier));
      t.setDestination(sortie);
      t.transform();
      for (XdmItem faute : xpath.evaluate("//svrl:failed-assert[@flag='fatal']", sortie.getXdmNode())) {
        String id = xpath.evaluate("string(@id)", faute).toString();
        String texte = xpath.evaluate("normalize-space(svrl:text)", faute).toString();
        System.out.println(fichier.getName() + "\t" + id + "\t" + texte);
      }
      System.out.println(fichier.getName() + "\tLU");
    }
  }
}
